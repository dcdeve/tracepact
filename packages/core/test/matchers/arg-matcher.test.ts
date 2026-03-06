import { describe, expect, it } from 'vitest';
import { matchArgs } from '../../src/matchers/arg-matcher.js';

describe('matchArgs', () => {
  it('matches exact values', () => {
    const result = matchArgs({ path: 'a.ts', content: 'hello' }, { path: 'a.ts' });
    expect(result.matches).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('reports mismatch on different value', () => {
    const result = matchArgs({ path: 'a.ts' }, { path: 'b.ts' });
    expect(result.matches).toBe(false);
    expect(result.mismatches[0].field).toBe('path');
  });

  it('matches regex against string', () => {
    const result = matchArgs({ path: 'src/main.ts' }, { path: /src\/.*\.ts/ });
    expect(result.matches).toBe(true);
  });

  it('reports regex mismatch', () => {
    const result = matchArgs({ path: 'lib/main.js' }, { path: /src\/.*\.ts/ });
    expect(result.matches).toBe(false);
  });

  it('errors on regex against non-string', () => {
    const result = matchArgs({ count: 5 }, { count: /5/ });
    expect(result.matches).toBe(false);
    expect(result.mismatches[0].error).toContain('Cannot apply regex');
  });

  it('allows extra fields in actual (partial match)', () => {
    const result = matchArgs({ path: 'a', content: 'b', extra: true }, { path: 'a' });
    expect(result.matches).toBe(true);
  });

  it('reports missing field as mismatch', () => {
    const result = matchArgs({}, { path: 'a.ts' });
    expect(result.matches).toBe(false);
  });

  it('deep matches nested objects', () => {
    const actual = { config: { timeout: 30, retries: 3, nested: { a: 1 } } };
    const expected = { config: { timeout: 30, nested: { a: 1 } } };
    const result = matchArgs(actual, expected);
    expect(result.matches).toBe(true);
  });

  it('reports deep mismatch with dotted path', () => {
    const actual = { config: { timeout: 30, mode: 'fast' } };
    const expected = { config: { timeout: 30, mode: 'slow' } };
    const result = matchArgs(actual, expected);
    expect(result.matches).toBe(false);
    expect(result.mismatches[0].field).toBe('config.mode');
  });

  it('deep matches arrays element by element', () => {
    const actual = { items: [{ id: 1 }, { id: 2 }] };
    const expected = { items: [{ id: 1 }, { id: 2 }] };
    const result = matchArgs(actual, expected);
    expect(result.matches).toBe(true);
  });

  it('reports array length mismatch', () => {
    const actual = { items: [1, 2] };
    const expected = { items: [1, 2, 3] };
    const result = matchArgs(actual, expected);
    expect(result.matches).toBe(false);
    expect(result.mismatches[0].field).toBe('items');
  });

  it('reports nested array element mismatch', () => {
    const actual = { items: [{ id: 1 }, { id: 99 }] };
    const expected = { items: [{ id: 1 }, { id: 2 }] };
    const result = matchArgs(actual, expected);
    expect(result.matches).toBe(false);
    expect(result.mismatches[0].field).toBe('items[1].id');
  });
});
