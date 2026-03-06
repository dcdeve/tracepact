import { describe, expect, it } from 'vitest';
import { DEFAULT_CACHE, DEFAULT_REDACTION } from '../src/config/defaults.js';
import { defineConfig } from '../src/config/define-config.js';
import { ConfigError } from '../src/errors/config-error.js';

describe('defineConfig', () => {
  it('returns merged config with defaults for valid minimal input', () => {
    const config = defineConfig({
      providers: {
        default: 'claude',
        claude: { model: 'claude-sonnet-4-20250514' },
      },
    });

    expect(config.providers.default).toBe('claude');
    expect(config.cache).toEqual(DEFAULT_CACHE);
    expect(config.redaction).toEqual(DEFAULT_REDACTION);
    expect(config.skill).toBeUndefined();
    expect(config.vitest).toBeUndefined();
  });

  it('throws ConfigError when providers exists but default is missing', () => {
    expect(() => defineConfig({ providers: {} as any })).toThrow(ConfigError);
  });

  it('allows empty config for mock-only mode', () => {
    const config = defineConfig({});
    expect(config.providers).toBeUndefined();
    expect(config.cache).toEqual(DEFAULT_CACHE);
    expect(config.redaction).toEqual(DEFAULT_REDACTION);
  });

  it('throws ConfigError when default references nonexistent provider', () => {
    expect(() => defineConfig({ providers: { default: 'openai' } })).toThrow(ConfigError);
  });

  it('merges cache overrides with defaults', () => {
    const config = defineConfig({
      providers: {
        default: 'claude',
        claude: { model: 'claude-sonnet-4-20250514' },
      },
      cache: { ttlSeconds: 3600 } as any,
    });

    expect(config.cache.ttlSeconds).toBe(3600);
    expect(config.cache.enabled).toBe(DEFAULT_CACHE.enabled);
    expect(config.cache.dir).toBe(DEFAULT_CACHE.dir);
    expect(config.cache.verifyOnRead).toBe(DEFAULT_CACHE.verifyOnRead);
  });

  it('uses DEFAULT_REDACTION when no redaction key is provided', () => {
    const config = defineConfig({
      providers: {
        default: 'claude',
        claude: { model: 'claude-sonnet-4-20250514' },
      },
    });

    expect(config.redaction).toEqual(DEFAULT_REDACTION);
  });

  it('preserves skill and vitest passthrough fields', () => {
    const config = defineConfig({
      skill: './SKILL.md',
      providers: {
        default: 'claude',
        claude: { model: 'claude-sonnet-4-20250514' },
      },
      vitest: { timeout: 5000 },
    });

    expect(config.skill).toBe('./SKILL.md');
    expect(config.vitest).toEqual({ timeout: 5000 });
  });

  it('ConfigError has correct code and field', () => {
    try {
      defineConfig({ providers: {} as any });
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).code).toBe('CONFIG_ERROR');
      expect((err as ConfigError).field).toBe('providers.default');
    }
  });
});
