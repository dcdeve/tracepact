import { defineConfig } from '../config/define-config.js';
import type { TracepactConfig } from '../config/types.js';
import { log } from '../logger.js';
import { SNAPSHOT_PROVIDERS } from '../models/snapshot.js';
import { PROVIDER_ENV_KEYS } from './presets.js';

/**
 * Get the default model for a provider from the snapshot catalog.
 * Picks the first model tagged 'recommended', or the first model overall.
 */
export function getDefaultModel(provider: string): string {
  const providerInfo = SNAPSHOT_PROVIDERS.find((p) => p.id === provider);
  if (!providerInfo || providerInfo.models.length === 0) return 'gpt-4o';
  const recommended = providerInfo.models.find((m) => m.tags.includes('recommended'));
  const model = recommended ?? providerInfo.models[0];
  return model ? model.id : 'gpt-4o';
}

/**
 * Auto-detect provider from explicit env var or available API keys.
 * Priority: TRACEPACT_PROVIDER > first available key in order.
 */
export function detectProvider(): string {
  if (process.env.TRACEPACT_PROVIDER) {
    log.debug(
      'provider detected: %s (reason: TRACEPACT_PROVIDER env var)',
      process.env.TRACEPACT_PROVIDER
    );
    return process.env.TRACEPACT_PROVIDER;
  }

  const candidates = Object.entries(PROVIDER_ENV_KEYS);

  for (const [name, envKey] of candidates) {
    if (process.env[envKey]) {
      log.debug('provider detected: %s (reason: %s env var is set)', name, envKey);
      return name;
    }
  }

  log.debug('provider detected: openai (reason: no API key env vars found, using default)');
  return 'openai';
}

/**
 * Build a TracepactConfig from env vars and optional overrides.
 */
export function resolveConfig(
  providerName: string,
  overrides?: Partial<TracepactConfig>
): TracepactConfig {
  if (overrides?.providers) {
    return defineConfig(overrides);
  }

  const providers: { default: string; [k: string]: any } = { default: providerName };

  const envKey = PROVIDER_ENV_KEYS[providerName];
  const apiKey = envKey ? process.env[envKey] : undefined;
  providers[providerName] = {
    model: process.env.TRACEPACT_MODEL ?? getDefaultModel(providerName),
    ...(apiKey ? { apiKey } : {}),
  };

  return defineConfig({ providers, ...overrides });
}
