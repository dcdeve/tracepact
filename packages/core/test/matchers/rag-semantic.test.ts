import { describe, expect, it } from 'vitest';
import {
  toHaveGroundedResponseIn,
  toHaveRetrievalScore,
  toNotHaveHallucinated,
} from '../../src/matchers/rag/semantic.js';
import type { EmbeddingProvider } from '../../src/matchers/tier3/embeddings.js';
import type { ToolTrace } from '../../src/trace/types.js';

/**
 * Mock embedding provider that uses simple character-frequency vectors.
 * Similar strings produce similar vectors — good enough for testing logic.
 */
function createMockProvider(): EmbeddingProvider {
  return {
    model: 'mock-embed',
    dimensions: 26,
    async embed(texts: string[]): Promise<number[][]> {
      return texts.map((text) => {
        const vec = new Array(26).fill(0) as number[];
        for (const ch of text.toLowerCase()) {
          const idx = ch.charCodeAt(0) - 97;
          if (idx >= 0 && idx < 26) vec[idx]++;
        }
        // Normalize
        const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
        return vec.map((v) => v / norm);
      });
    },
  };
}

function makeRagTrace(query: string, docs: Array<{ content: string }>): ToolTrace {
  return {
    calls: [
      {
        toolName: 'search',
        args: { query },
        result: {
          type: 'success',
          content: JSON.stringify({ results: docs }),
        },
        durationMs: 100,
        sequenceIndex: 0,
        unknownTool: false,
      },
    ],
    totalCalls: 1,
    totalDurationMs: 100,
  };
}

const provider = createMockProvider();

describe('toHaveGroundedResponseIn', () => {
  it('passes when output is similar to retrieved docs', async () => {
    const trace = makeRagTrace('deployment', [
      { content: 'how to deploy applications to staging environment' },
    ]);
    const output = 'deploy the application to the staging environment';
    const result = await toHaveGroundedResponseIn(trace, output, 'search', {
      provider,
      threshold: 0.7,
    });
    expect(result.pass).toBe(true);
    expect(result.tier).toBe(3);
  });

  it('fails when output is unrelated to retrieved docs', async () => {
    const trace = makeRagTrace('deployment', [
      { content: 'how to deploy applications to staging' },
    ]);
    const output = 'the quick brown fox jumps over the lazy dog';
    const result = await toHaveGroundedResponseIn(trace, output, 'search', {
      provider,
      threshold: 0.95,
    });
    expect(result.pass).toBe(false);
  });

  it('fails when no retrieval results', async () => {
    const emptyTrace: ToolTrace = { calls: [], totalCalls: 0, totalDurationMs: 0 };
    const result = await toHaveGroundedResponseIn(emptyTrace, 'output', 'search', { provider });
    expect(result.pass).toBe(false);
    expect(result.message).toContain('No retrieval results');
  });
});

describe('toNotHaveHallucinated', () => {
  it('passes when all claims are supported', async () => {
    const trace = makeRagTrace('staging', [
      { content: 'the staging server runs on port three thousand' },
      { content: 'deployment uses a rolling strategy for staging' },
    ]);
    const output =
      'The staging server runs on port three thousand. Deployment uses rolling strategy.';
    const result = await toNotHaveHallucinated(trace, output, 'search', {
      provider,
      threshold: 0.5,
    });
    expect(result.pass).toBe(true);
    expect(result.tier).toBe(3);
  });

  it('fails when claims are unsupported', async () => {
    const trace = makeRagTrace('staging', [
      { content: 'the staging server runs on port three thousand' },
    ]);
    const output =
      'The staging server runs on port three thousand. The production database uses MongoDB with sharding.';
    const result = await toNotHaveHallucinated(trace, output, 'search', {
      provider,
      threshold: 0.9,
    });
    expect(result.pass).toBe(false);
    expect(result.diagnostic.received).toBeInstanceOf(Array);
  });

  it('fails with skipped diagnostic when no checkable sentences found', async () => {
    const trace = makeRagTrace('test', [{ content: 'some doc' }]);
    const result = await toNotHaveHallucinated(trace, 'OK.', 'search', { provider });
    expect(result.pass).toBe(false);
    expect(result.message).toContain('No checkable sentences');
    expect(result.diagnostic.received).toBe('skipped: no checkable sentences');
  });
});

describe('toHaveRetrievalScore', () => {
  it('passes when query is relevant to docs', async () => {
    const trace = makeRagTrace('deploy staging application', [
      { content: 'deploying applications to staging environment' },
    ]);
    const result = await toHaveRetrievalScore(trace, 'search', {
      provider,
      threshold: 0.7,
    });
    expect(result.pass).toBe(true);
    expect(result.tier).toBe(3);
  });

  it('fails when query is unrelated to docs', async () => {
    const trace = makeRagTrace('quantum physics equations', [
      { content: 'deploying applications to staging environment' },
    ]);
    const result = await toHaveRetrievalScore(trace, 'search', {
      provider,
      threshold: 0.95,
    });
    expect(result.pass).toBe(false);
  });

  it('fails when no query found in args', async () => {
    const trace: ToolTrace = {
      calls: [
        {
          toolName: 'search',
          args: { filter: 'something' },
          result: { type: 'success', content: JSON.stringify({ results: [{ content: 'doc' }] }) },
          durationMs: 50,
          sequenceIndex: 0,
          unknownTool: false,
        },
      ],
      totalCalls: 1,
      totalDurationMs: 50,
    };
    const result = await toHaveRetrievalScore(trace, 'search', { provider });
    expect(result.pass).toBe(false);
    expect(result.message).toContain('No query found');
  });
});
