import type { CacheConfig, RedactionConfig, RetryConfig } from './types.js';

export const DEFAULT_CACHE: CacheConfig = {
  enabled: true,
  dir: '.tracepact/cache',
  ttlSeconds: 604_800,
  verifyOnRead: true,
};

export const DEFAULT_REDACTION: RedactionConfig = {
  rules: [],
  redactEnvValues: [],
};

export const DEFAULT_RETRY: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
};

export const DEFAULT_MAX_CONCURRENCY = 5;
export const DEFAULT_TEMPERATURE = 0;
export const DEFAULT_MAX_TOOL_ITERATIONS = 20;
export const DEFAULT_TEST_TIMEOUT = 30_000;
