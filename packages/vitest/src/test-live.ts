import type { TestAPI } from 'vitest';
import { test as vitestTest } from 'vitest';

/**
 * test.live() — skipped by default, runs only with TRACEPACT_LIVE=1.
 * Shows as "skipped" in normal runs, giving visibility.
 */
// Cast needed: skipIf returns ChainableTestAPI which uses non-exported internal types
export const live = vitestTest.skipIf(process.env.TRACEPACT_LIVE !== '1') as TestAPI;
