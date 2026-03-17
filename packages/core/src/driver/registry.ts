import type { ProviderConfig, TracepactConfig } from '../config/types.js';
import { ConfigError } from '../errors/config-error.js';
import { log } from '../logger.js';
import { AnthropicDriver } from './anthropic-driver.js';
import { OpenAIDriver } from './openai-driver.js';
import { PROVIDER_ENV_KEYS, PROVIDER_PRESETS } from './presets.js';
import type { AgentDriver, HealthCheckResult } from './types.js';

type DriverConstructor = new (opts: any) => AgentDriver;

// Providers that require a dedicated driver class.
// All other providers fall back to OpenAIDriver (OpenAI-compatible API).
const NATIVE_DRIVERS: Record<string, DriverConstructor> = {
  anthropic: AnthropicDriver,
};

/**
 * Register a custom driver constructor for a provider name.
 *
 * Call this before constructing a DriverRegistry (or before any executePrompt call).
 * The registered constructor will be used instead of the OpenAI-compatible fallback
 * whenever that provider name is resolved.
 *
 * @example
 * ```ts
 * import { DriverRegistry } from '@tracepact/core';
 * DriverRegistry.register('bedrock', BedrockDriver);
 * ```
 */
function registerDriver(name: string, DriverClass: DriverConstructor): void {
  NATIVE_DRIVERS[name] = DriverClass;
}

function createDriver(name: string, config: ProviderConfig): AgentDriver {
  // Resolve API key: explicit config > env var for this provider > env var fallback
  const envKey = PROVIDER_ENV_KEYS[name];
  const apiKey = config.apiKey ?? (envKey ? process.env[envKey] : undefined);

  const baseOpts: any = {
    model: config.model,
    providerName: name,
  };
  if (apiKey) baseOpts.apiKey = apiKey;
  if (config.maxConcurrency !== undefined) baseOpts.maxConcurrency = config.maxConcurrency;
  if (config.retry) baseOpts.retry = config.retry;

  // Use dedicated driver if one is registered for this provider
  const NativeDriver = NATIVE_DRIVERS[name];
  if (NativeDriver) {
    return new NativeDriver(baseOpts);
  }

  // All other providers go through OpenAI-compatible driver
  const preset = PROVIDER_PRESETS[name];
  const baseURL = config.baseURL ?? preset?.baseURL;

  if (!baseURL && name !== 'openai') {
    log.warn(
      `Provider "${name}" has no preset baseURL and none was configured. Requests will go to the default OpenAI endpoint. Set providers.${name}.baseURL or use a provider with a preset (groq, deepseek, etc.).`
    );
  }

  if (baseURL) baseOpts.baseURL = baseURL;

  return new OpenAIDriver(baseOpts);
}

export class DriverRegistry {
  /**
   * Register a custom driver constructor for a provider name.
   * Delegates to the module-level registry used by all DriverRegistry instances.
   *
   * @example
   * ```ts
   * import { DriverRegistry } from '@tracepact/core';
   * DriverRegistry.register('bedrock', BedrockDriver);
   * ```
   */
  static register(name: string, DriverClass: DriverConstructor): void {
    registerDriver(name, DriverClass);
  }

  private drivers = new Map<string, AgentDriver>();
  private initErrors = new Map<string, Error>();
  private defaultName: string;

  constructor(config: TracepactConfig) {
    this.defaultName = config.providers?.default ?? '';

    for (const [name, providerConfig] of Object.entries(config.providers ?? {})) {
      if (name === 'default') continue;
      if (typeof providerConfig === 'string') continue;

      try {
        this.drivers.set(name, createDriver(name, providerConfig));
      } catch (err: any) {
        log.warn(`Driver "${name}" failed to initialize: ${err.message}. It will error if used.`);
        this.initErrors.set(name, err);
      }
    }
  }

  getDefault(): AgentDriver {
    return this.get(this.defaultName);
  }

  get(name: string): AgentDriver {
    const driver = this.drivers.get(name);
    if (!driver) {
      const initError = this.initErrors.get(name);
      if (initError) {
        throw new ConfigError(
          `providers.${name}`,
          `Provider "${name}" failed to initialize: ${initError.message}`
        );
      }
      throw new ConfigError(`providers.${name}`, `Provider "${name}" is not configured.`);
    }
    return driver;
  }

  /**
   * Throw a ConfigError listing all providers that failed to initialize.
   * Call this in suite setup (e.g. globalSetup) to surface misconfiguration
   * (missing API keys, invalid options) before any test runs.
   *
   * Providers that initialized successfully are not affected.
   */
  validateAll(): void {
    if (this.initErrors.size === 0) return;
    const details = [...this.initErrors.entries()]
      .map(([name, err]) => `  - ${name}: ${err.message}`)
      .join('\n');
    throw new ConfigError('providers', `The following providers failed to initialize:\n${details}`);
  }

  getAll(): Map<string, AgentDriver> {
    return new Map(this.drivers);
  }

  async healthCheckAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    for (const [name, driver] of this.drivers) {
      results.set(name, await driver.healthCheck());
    }
    return results;
  }
}
