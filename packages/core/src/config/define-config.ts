import { ConfigError } from '../errors/config-error.js';
import { DEFAULT_CACHE, DEFAULT_REDACTION } from './defaults.js';
import type { TracepactConfig } from './types.js';

export function defineConfig(input: Partial<TracepactConfig>): TracepactConfig {
  // Support new shorthand: model: "provider/model"
  let providers = input.providers;
  if (!providers && input.model) {
    const [providerName, modelId] = input.model.split('/');
    if (!providerName || !modelId) {
      throw new ConfigError(
        'model',
        'model must be in "provider/model" format (e.g. "anthropic/claude-sonnet-4-5").'
      );
    }
    providers = {
      default: providerName,
      [providerName]: { model: modelId },
    };
  }

  if (providers && !providers.default) {
    throw new ConfigError(
      'providers.default',
      'Must specify a default provider name or use the model shorthand.'
    );
  }

  if (providers?.default) {
    const defaultProviderName = providers.default;
    if (typeof defaultProviderName === 'string' && !(defaultProviderName in providers)) {
      throw new ConfigError(
        `providers.${defaultProviderName}`,
        `Default provider "${defaultProviderName}" is referenced but not configured.`
      );
    }
  }

  const config: TracepactConfig = {
    cache: { ...DEFAULT_CACHE, ...input.cache },
    redaction: { ...DEFAULT_REDACTION, ...input.redaction },
  };

  if (providers) config.providers = providers;

  if (input.skill !== undefined) config.skill = input.skill;
  if (input.model !== undefined) config.model = input.model;
  if (input.roles !== undefined) config.roles = input.roles;
  if (input.vitest !== undefined) config.vitest = input.vitest;

  return config;
}
