import { describe, expect, it } from 'vitest';
import { PROVIDER_ENV_KEYS, PROVIDER_PRESETS } from '../src/driver/presets.js';

describe('PROVIDER_PRESETS', () => {
  it('contains expected providers', () => {
    expect(PROVIDER_PRESETS.groq).toBeDefined();
    expect(PROVIDER_PRESETS.deepseek).toBeDefined();
    expect(PROVIDER_PRESETS.together).toBeDefined();
    expect(PROVIDER_PRESETS.mistral).toBeDefined();
    expect(PROVIDER_PRESETS.openrouter).toBeDefined();
    expect(PROVIDER_PRESETS.xai).toBeDefined();
    expect(PROVIDER_PRESETS.cerebras).toBeDefined();
    expect(PROVIDER_PRESETS.fireworks).toBeDefined();
    expect(PROVIDER_PRESETS.perplexity).toBeDefined();
  });

  it('each preset has baseURL and envKey', () => {
    for (const [name, preset] of Object.entries(PROVIDER_PRESETS)) {
      expect(preset.baseURL, `${name} missing baseURL`).toBeTruthy();
      expect(preset.envKey, `${name} missing envKey`).toBeTruthy();
    }
  });
});

describe('PROVIDER_ENV_KEYS', () => {
  it('includes openai and anthropic', () => {
    expect(PROVIDER_ENV_KEYS.openai).toBe('OPENAI_API_KEY');
    expect(PROVIDER_ENV_KEYS.anthropic).toBe('ANTHROPIC_API_KEY');
  });

  it('includes all preset providers', () => {
    for (const [name, preset] of Object.entries(PROVIDER_PRESETS)) {
      expect(PROVIDER_ENV_KEYS[name], `${name} missing from ENV_KEYS`).toBe(preset.envKey);
    }
  });
});
