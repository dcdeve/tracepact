import { describe, expect, it } from 'vitest';
import { cosineSimilarity } from '../../../src/matchers/tier3/cosine.js';

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
  });

  it('returns -1.0 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it('returns >0.99 for similar vectors', () => {
    expect(cosineSimilarity([1, 0.1], [1, 0.2])).toBeGreaterThan(0.99);
  });

  it('throws on length mismatch', () => {
    expect(() => cosineSimilarity([1, 0], [1, 0, 0])).toThrow('Vector length mismatch');
  });

  it('returns 0.0 for zero vector', () => {
    expect(cosineSimilarity([0, 0], [1, 0])).toBeCloseTo(0.0);
  });
});
