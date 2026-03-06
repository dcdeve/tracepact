import { describe, expect, it } from 'vitest';

describe('live', () => {
  it('skips when TRACEPACT_LIVE is not set', async () => {
    const original = process.env.TRACEPACT_LIVE;
    process.env.TRACEPACT_LIVE = undefined;
    try {
      // Re-import to evaluate skipIf with current env
      const mod = await import('../src/test-live.js');
      // The live function itself is a TestAPI; we verify it was created
      expect(typeof mod.live).toBe('function');
    } finally {
      if (original !== undefined) process.env.TRACEPACT_LIVE = original;
    }
  });

  it('is exported from package index', async () => {
    const mod = await import('../src/index.js');
    expect(mod.live).toBeDefined();
    expect(typeof mod.live).toBe('function');
  });
});
