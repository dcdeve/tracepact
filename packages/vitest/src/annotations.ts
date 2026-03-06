import type { TestAPI } from 'vitest';
import { test as vitestTest } from 'vitest';

/**
 * test.expensive() -- skipped by default, runs with --full flag.
 * For Tier 3-4 assertions and container sandbox tests.
 */
// Cast needed: skipIf returns ChainableTestAPI which uses non-exported internal types
export const expensive = vitestTest.skipIf(process.env.TRACEPACT_FULL !== '1') as TestAPI;

/**
 * test.cheap() -- alias for regular test. Always runs.
 * Annotation is for documentation clarity.
 */
export const cheap: TestAPI = vitestTest;
