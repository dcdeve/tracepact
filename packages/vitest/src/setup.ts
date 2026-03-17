import {
  DriverRegistry,
  clearEmbeddingCache,
  clearRegistryCache,
  detectProvider,
  initLogLevelFromEnv,
  resetCache,
  resolveConfig,
} from '@tracepact/core';

initLogLevelFromEnv();
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest';
import { tracepactMatchers } from './matchers.js';
import { _closePendingMcpConnections } from './run-skill.js';

expect.extend(tracepactMatchers);

beforeEach(() => {
  clearEmbeddingCache();
});

afterEach(async () => {
  await _closePendingMcpConnections();
});

afterAll(() => {
  clearEmbeddingCache();
  clearRegistryCache();
  resetCache();
});

// HealthCheck before suite (live mode only)
if (process.env.TRACEPACT_LIVE === '1') {
  beforeAll(async () => {
    const providerName = process.env.TRACEPACT_PROVIDER || detectProvider();
    const strict = process.env.TRACEPACT_HEALTH_CHECK_STRICT === '1';

    let errorMessage: string | undefined;

    try {
      const config = resolveConfig(providerName);
      const registry = new DriverRegistry(config);
      registry.validateAll();
      const driver = registry.get(providerName);
      const health = await driver.healthCheck();

      if (health.ok) {
        console.error(
          `  \u2713 Provider "${providerName}": reachable (${Math.round(health.latencyMs)}ms, ${health.model})`
        );
        return;
      }
      errorMessage = health.error;
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    console.error(`  \u2717 Provider "${providerName}": ${errorMessage}`);
    if (strict) {
      process.exitCode = 4;
      throw new Error(
        `Health check failed: provider "${providerName}" unreachable — ${errorMessage}`
      );
    }
  }, 30_000);
}
