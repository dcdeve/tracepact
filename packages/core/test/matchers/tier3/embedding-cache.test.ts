import { describe, expect, it } from 'vitest';
import { EmbeddingCache } from '../../../src/matchers/tier3/embedding-cache.js';

describe('EmbeddingCache', () => {
  it('returns embedding after set', () => {
    const cache = new EmbeddingCache();
    const vec = [0.1, 0.2, 0.3];
    cache.set('hello', vec);
    expect(cache.get('hello')).toEqual(vec);
  });

  it('returns undefined for missing key', () => {
    const cache = new EmbeddingCache();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('returns cache hit for same text', () => {
    const cache = new EmbeddingCache();
    cache.set('same text', [1, 2]);
    expect(cache.has('same text')).toBe(true);
  });

  it('returns cache miss for different text', () => {
    const cache = new EmbeddingCache();
    cache.set('text A', [1, 2]);
    expect(cache.has('text B')).toBe(false);
  });

  it('clears all entries', () => {
    const cache = new EmbeddingCache();
    cache.set('a', [1]);
    cache.set('b', [2]);
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});
