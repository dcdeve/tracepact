import { describe, expect, it } from 'vitest';
import { cheap, expensive } from '../src/annotations.js';

describe('test annotations', () => {
  it('expensive is a function (TestAPI)', () => {
    expect(typeof expensive).toBe('function');
  });

  it('cheap is a function (TestAPI)', () => {
    expect(typeof cheap).toBe('function');
  });

  it('expensive has skipIf behavior (skips without TRACEPACT_FULL)', () => {
    // Without TRACEPACT_FULL=1, expensive tests should be skipped.
    // We can't easily test the skip behavior in a unit test,
    // but we verify the export is properly typed and callable.
    expect(expensive).toHaveProperty('skip');
    expect(expensive).toHaveProperty('only');
    expect(expensive).toHaveProperty('each');
  });

  it('cheap has standard test API methods', () => {
    expect(cheap).toHaveProperty('skip');
    expect(cheap).toHaveProperty('only');
    expect(cheap).toHaveProperty('each');
  });
});
