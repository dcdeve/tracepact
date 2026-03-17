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
import { afterAll, afterEach, beforeEach, expect } from 'vitest';
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
  const providerName = process.env.TRACEPACT_PROVIDER || detectProvider();
  const strict = process.env.TRACEPACT_HEALTH_CHECK_STRICT === '1';

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
