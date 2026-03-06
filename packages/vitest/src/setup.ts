import { DriverRegistry, PROVIDER_ENV_KEYS, defineConfig } from '@tracepact/core';
import { expect } from 'vitest';
import { tracepactMatchers } from './matchers.js';

expect.extend(tracepactMatchers);

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  claude: 'claude-sonnet-4-5-20250929',
  anthropic: 'claude-sonnet-4-5-20250929',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-large-latest',
};

// HealthCheck before suite (live mode only)
if (process.env.TRACEPACT_LIVE === '1') {
  const providerName = process.env.TRACEPACT_PROVIDER || detectProviderFromEnv();
  const strict = process.env.TRACEPACT_HEALTH_CHECK_STRICT === '1';

  try {
    const envKey = PROVIDER_ENV_KEYS[providerName];
    const apiKey = envKey ? process.env[envKey] : undefined;
    const model = process.env.TRACEPACT_MODEL ?? DEFAULT_MODELS[providerName] ?? 'gpt-4o';

    const providers: { default: string; [k: string]: any } = {
      default: providerName,
      [providerName]: { model, ...(apiKey ? { apiKey } : {}) },
    };

    const config = defineConfig({ providers });
    const registry = new DriverRegistry(config);
    const driver = registry.get(providerName);
    const health = await driver.healthCheck();

    if (health.ok) {
      console.error(
        `  \u2713 Provider "${providerName}": reachable (${Math.round(health.latencyMs)}ms, ${health.model})`
      );
    } else {
      console.error(`  \u2717 Provider "${providerName}": ${health.error}`);
      if (strict) {
        console.error('  Health check failed in strict mode. Exiting.');
        process.exit(4);
      }
    }
  } catch (err: any) {
    console.error(`  \u2717 Provider "${providerName}": ${err.message}`);
    if (strict) {
      console.error('  Health check failed in strict mode. Exiting.');
      process.exit(4);
    }
  }
}

function detectProviderFromEnv(): string {
  const candidates: Array<[string, string]> = [
    ['openai', 'OPENAI_API_KEY'],
    ['anthropic', 'ANTHROPIC_API_KEY'],
    ['groq', 'GROQ_API_KEY'],
    ['deepseek', 'DEEPSEEK_API_KEY'],
    ['together', 'TOGETHER_API_KEY'],
    ['mistral', 'MISTRAL_API_KEY'],
    ['openrouter', 'OPENROUTER_API_KEY'],
    ['xai', 'XAI_API_KEY'],
  ];
  for (const [name, envKey] of candidates) {
    if (process.env[envKey]) return name;
  }
  return 'openai';
}
