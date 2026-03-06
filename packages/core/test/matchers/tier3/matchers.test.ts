import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearEmbeddingCache,
  toBeSemanticallySimilar,
  toHaveSemanticOverlap,
} from '../../../src/matchers/tier3/index.js';
import type { EmbeddingProvider } from '../../../src/matchers/tier3/index.js';

/**
 * Mock provider that returns pre-defined embeddings keyed by text.
 * Embeddings are simple 3D vectors for easy cosine similarity control.
 */
function mockProvider(map: Record<string, number[]>): EmbeddingProvider {
  return {
    model: 'mock',
    dimensions: 3,
    async embed(texts: string[]): Promise<number[][]> {
      return texts.map((t) => {
        const emb = map[t];
        if (!emb) throw new Error(`No mock embedding for: "${t}"`);
        return emb;
      });
    },
  };
}

describe('toBeSemanticallySimilar', () => {
  beforeEach(() => clearEmbeddingCache());

  it('passes when similarity is above threshold', async () => {
    // cosine([1,0,0], [0.95,0.05,0]) ≈ 0.998
    const provider = mockProvider({
      'output text': [1, 0, 0],
      'reference text': [0.95, 0.05, 0],
    });

    const result = await toBeSemanticallySimilar('output text', 'reference text', {
      provider,
      threshold: 0.8,
    });

    expect(result.pass).toBe(true);
    expect(result.tier).toBe(3);
    expect(result.diagnostic.tokens).toBeGreaterThan(0);
  });

  it('fails when similarity is below threshold', async () => {
    // cosine([1,0,0], [0,1,0]) = 0.0
    const provider = mockProvider({
      'about cats': [1, 0, 0],
      'about databases': [0, 1, 0],
    });

    const result = await toBeSemanticallySimilar('about cats', 'about databases', {
      provider,
      threshold: 0.8,
    });

    expect(result.pass).toBe(false);
    expect(result.diagnostic.suggestion).toContain('different topic');
  });

  it('suggests lowering threshold when close', async () => {
    // cosine([1,0,0], [0.8,0.6,0]) ≈ 0.8 (exactly at boundary area)
    const provider = mockProvider({
      output: [1, 0, 0],
      reference: [0.75, 0.66, 0],
    });

    const result = await toBeSemanticallySimilar('output', 'reference', {
      provider,
      threshold: 0.85,
    });

    // similarity ≈ 0.75 which is within 0.10 of 0.85
    expect(result.pass).toBe(false);
    expect(result.diagnostic.suggestion).toContain('Close to threshold');
  });
});

describe('toHaveSemanticOverlap', () => {
  beforeEach(() => clearEmbeddingCache());

  it('passes when all topics match', async () => {
    const provider = mockProvider({
      'output about security and SQL': [1, 0.9, 0.8],
      'SQL injection': [0.95, 0.85, 0.75],
      'input sanitization': [0.9, 0.95, 0.8],
      'parameterized queries': [0.85, 0.9, 0.95],
    });

    const result = await toHaveSemanticOverlap(
      'output about security and SQL',
      ['SQL injection', 'input sanitization', 'parameterized queries'],
      { provider, threshold: 0.75 }
    );

    expect(result.pass).toBe(true);
    expect(result.message).toContain('3/3');
  });

  it('fails when not enough topics match', async () => {
    // Topic C is orthogonal to output
    const provider = mockProvider({
      output: [1, 0, 0],
      'topic A': [0.95, 0.05, 0],
      'topic B': [0, 1, 0],
      'topic C': [0, 0, 1],
    });

    const result = await toHaveSemanticOverlap('output', ['topic A', 'topic B', 'topic C'], {
      provider,
      threshold: 0.75,
      minTopics: 2,
    });

    expect(result.pass).toBe(false);
    expect(result.diagnostic.suggestion).toContain('Missed topics');
  });

  it('passes with minTopics when enough match', async () => {
    const provider = mockProvider({
      output: [1, 0, 0],
      'topic A': [0.98, 0.02, 0],
      'topic B': [0.96, 0.04, 0],
      'topic C': [0, 0, 1], // orthogonal — won't match
    });

    const result = await toHaveSemanticOverlap('output', ['topic A', 'topic B', 'topic C'], {
      provider,
      threshold: 0.75,
      minTopics: 2,
    });

    expect(result.pass).toBe(true);
    expect(result.message).toContain('2/3');
  });

  it('includes tokens in diagnostic', async () => {
    const provider = mockProvider({
      output: [1, 0, 0],
      topic: [0.9, 0.1, 0],
    });

    const result = await toHaveSemanticOverlap('output', ['topic'], { provider });
    expect(result.diagnostic.tokens).toBeGreaterThan(0);
  });
});
