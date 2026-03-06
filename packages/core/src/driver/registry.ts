import type { ProviderConfig, TracepactConfig } from '../config/types.js';
import { ConfigError } from '../errors/config-error.js';
import { log } from '../logger.js';
import { AnthropicDriver } from './anthropic-driver.js';
import { OpenAIDriver } from './openai-driver.js';
import { PROVIDER_ENV_KEYS, PROVIDER_PRESETS } from './presets.js';
import type { AgentDriver, HealthCheckResult } from './types.js';

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

  // Use native AnthropicDriver for anthropic provider
  if (name === 'anthropic') {
    return new AnthropicDriver(baseOpts);
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
  private drivers = new Map<string, AgentDriver>();
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
      }
    }
  }

  getDefault(): AgentDriver {
    return this.get(this.defaultName);
  }

  get(name: string): AgentDriver {
    const driver = this.drivers.get(name);
    if (!driver) {
      throw new ConfigError(
        `providers.${name}`,
        `Provider "${name}" is not configured or failed to initialize.`
      );
    }
    return driver;
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
