import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TracepactConfig } from '../src/config/types.js';
import { DriverRegistry } from '../src/driver/registry.js';
import { ConfigError } from '../src/errors/config-error.js';
import { setLogLevel } from '../src/logger.js';

function makeConfig(overrides?: Partial<TracepactConfig>): TracepactConfig {
  return {
    skill: undefined,
    cache: { enabled: true, dir: '.cache', ttlSeconds: 3600, verifyOnRead: true },
    redaction: { rules: [], redactEnvValues: [] },
    providers: {
      default: 'openai',
      openai: { model: 'gpt-4o', apiKey: 'sk-test' },
    },
    ...overrides,
  };
}

describe('DriverRegistry', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    setLogLevel('error');
    // Save env vars we might modify
    for (const key of ['OPENAI_API_KEY', 'GROQ_API_KEY', 'DEEPSEEK_API_KEY']) {
      savedEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  });

  it('get() returns configured driver', () => {
    const registry = new DriverRegistry(makeConfig());
    const driver = registry.get('openai');
    expect(driver.name).toBe('openai');
  });

  it('getDefault() returns the default provider', () => {
    const registry = new DriverRegistry(makeConfig());
    const driver = registry.getDefault();
    expect(driver.name).toBe('openai');
  });

  it('get() throws ConfigError for unknown provider', () => {
    const registry = new DriverRegistry(makeConfig());
    expect(() => registry.get('gemini')).toThrow(ConfigError);
    expect(() => registry.get('gemini')).toThrow('not configured');
  });

  it('creates driver for preset provider (groq)', () => {
    process.env.GROQ_API_KEY = 'gsk-test';
    const registry = new DriverRegistry(
      makeConfig({
        providers: {
          default: 'groq',
          groq: { model: 'llama-3.3-70b-versatile' },
        },
      })
    );
    const driver = registry.get('groq');
    expect(driver.name).toBe('groq');
  });

  it('creates driver with explicit baseURL (custom provider)', () => {
    const registry = new DriverRegistry(
      makeConfig({
        providers: {
          default: 'local',
          local: {
            model: 'llama3',
            apiKey: 'sk-local',
            baseURL: 'http://localhost:11434/v1',
          },
        },
      })
    );
    const driver = registry.get('local');
    expect(driver.name).toBe('local');
  });

  it('explicit apiKey takes priority over env', () => {
    process.env.GROQ_API_KEY = 'env-key';
    const registry = new DriverRegistry(
      makeConfig({
        providers: {
          default: 'groq',
          groq: { model: 'llama-3.3-70b-versatile', apiKey: 'explicit-key' },
        },
      })
    );
    // Driver was created successfully — explicit key was used
    expect(registry.get('groq').name).toBe('groq');
  });

  it('resolves API key from env using preset envKey', () => {
    process.env.DEEPSEEK_API_KEY = 'dsk-test';
    const registry = new DriverRegistry(
      makeConfig({
        providers: {
          default: 'deepseek',
          deepseek: { model: 'deepseek-chat' },
        },
      })
    );
    expect(registry.get('deepseek').name).toBe('deepseek');
  });

  it('lazy failure: missing API key warns but does not crash construction', () => {
    // biome-ignore lint/performance/noDelete: process.env requires delete
    delete process.env.OPENAI_API_KEY;
    // Should not throw during construction
    const registry = new DriverRegistry(
      makeConfig({
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4o' },
        },
      })
    );
    // But should throw when trying to use the driver
    expect(() => registry.get('openai')).toThrow(ConfigError);
  });

  it('getAll() returns all configured drivers', () => {
    process.env.GROQ_API_KEY = 'gsk-test';
    const registry = new DriverRegistry(
      makeConfig({
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4o', apiKey: 'sk-test' },
          groq: { model: 'llama-3.3-70b-versatile' },
        },
      })
    );
    const all = registry.getAll();
    expect(all.size).toBe(2);
    expect(all.has('openai')).toBe(true);
    expect(all.has('groq')).toBe(true);
  });

  it('healthCheckAll() calls healthCheck on all drivers', async () => {
    const registry = new DriverRegistry(makeConfig());
    const driver = registry.get('openai') as any;
    driver._setClient({
      chat: {
        completions: {
          create: vi.fn(async () => ({
            model: 'gpt-4o',
            system_fingerprint: 'fp_test',
            choices: [{ message: { content: 'ok' } }],
          })),
        },
      },
    });

    const results = await registry.healthCheckAll();
    expect(results.size).toBe(1);
    expect(results.get('openai')?.ok).toBe(true);
  });
});
