import { describe, expect, it } from 'vitest';
import {
  toHaveCitedSources,
  toHaveRetrievedDocument,
  toHaveRetrievedNResults,
  toHaveRetrievedTopResult,
  toNotHaveRetrievedDocument,
} from '../../src/matchers/rag/index.js';
import type { ToolTrace } from '../../src/trace/types.js';

function makeTrace(toolName: string, results: unknown[]): ToolTrace {
  return {
    calls: [
      {
        toolName,
        args: { query: 'test query' },
        result: { type: 'success', content: JSON.stringify({ results }) },
        durationMs: 100,
        sequenceIndex: 0,
        unknownTool: false,
      },
    ],
    totalCalls: 1,
    totalDurationMs: 100,
  };
}

const docs = [
  { id: 'doc-123', title: 'Deployment Guide', content: 'How to deploy to staging' },
  { id: 'doc-456', title: 'API Reference', content: 'REST endpoints' },
  { id: 'doc-789', title: 'Security Policy', metadata: { classification: 'confidential' } },
];

const trace = makeTrace('search', docs);

describe('toHaveRetrievedDocument', () => {
  it('passes when doc found by id', () => {
    const result = toHaveRetrievedDocument(trace, 'search', { id: 'doc-123' });
    expect(result.pass).toBe(true);
    expect(result.tier).toBe(0);
  });

  it('fails when doc not found', () => {
    const result = toHaveRetrievedDocument(trace, 'search', { id: 'doc-999' });
    expect(result.pass).toBe(false);
  });

  it('matches by content substring', () => {
    const result = toHaveRetrievedDocument(trace, 'search', { content: 'deploy to staging' });
    expect(result.pass).toBe(true);
  });

  it('fails when tool was never called', () => {
    const emptyTrace: ToolTrace = { calls: [], totalCalls: 0, totalDurationMs: 0 };
    const result = toHaveRetrievedDocument(emptyTrace, 'search', { id: 'doc-123' });
    expect(result.pass).toBe(false);
    expect(result.diagnostic.suggestion).toContain('never called');
  });
});

describe('toHaveRetrievedTopResult', () => {
  it('passes when first result matches', () => {
    const result = toHaveRetrievedTopResult(trace, 'search', { id: 'doc-123' });
    expect(result.pass).toBe(true);
  });

  it('fails when first result does not match', () => {
    const result = toHaveRetrievedTopResult(trace, 'search', { id: 'doc-456' });
    expect(result.pass).toBe(false);
  });
});

describe('toNotHaveRetrievedDocument', () => {
  it('passes when doc absent', () => {
    const result = toNotHaveRetrievedDocument(trace, 'search', { id: 'doc-999' });
    expect(result.pass).toBe(true);
  });

  it('fails when doc present', () => {
    const result = toNotHaveRetrievedDocument(trace, 'search', { id: 'doc-123' });
    expect(result.pass).toBe(false);
  });

  it('matches nested metadata', () => {
    const result = toNotHaveRetrievedDocument(trace, 'search', {
      metadata: { classification: 'confidential' },
    });
    expect(result.pass).toBe(false);
  });
});

describe('toHaveRetrievedNResults', () => {
  it('passes with correct count', () => {
    const result = toHaveRetrievedNResults(trace, 'search', 3);
    expect(result.pass).toBe(true);
  });

  it('fails with wrong count', () => {
    const result = toHaveRetrievedNResults(trace, 'search', 5);
    expect(result.pass).toBe(false);
    expect(result.diagnostic.received).toEqual({ count: 3 });
  });
});

describe('toHaveCitedSources', () => {
  const output = 'Based on doc-123 and doc-456, the deployment process involves...';

  it('passes when all sources cited', () => {
    const result = toHaveCitedSources(output, ['doc-123', 'doc-456']);
    expect(result.pass).toBe(true);
  });

  it('fails when some sources missing', () => {
    const result = toHaveCitedSources(output, ['doc-123', 'doc-789']);
    expect(result.pass).toBe(false);
    expect(result.diagnostic.received).toEqual({ missing: ['doc-789'] });
  });
});

describe('edge cases', () => {
  it('handles direct array format', () => {
    const directArrayTrace: ToolTrace = {
      calls: [
        {
          toolName: 'search',
          args: {},
          result: { type: 'success', content: JSON.stringify([{ id: 'x' }]) },
          durationMs: 50,
          sequenceIndex: 0,
          unknownTool: false,
        },
      ],
      totalCalls: 1,
      totalDurationMs: 50,
    };
    const result = toHaveRetrievedDocument(directArrayTrace, 'search', { id: 'x' });
    expect(result.pass).toBe(true);
  });

  it('handles non-JSON result gracefully', () => {
    const badTrace: ToolTrace = {
      calls: [
        {
          toolName: 'search',
          args: {},
          result: { type: 'success', content: 'not json' },
          durationMs: 50,
          sequenceIndex: 0,
          unknownTool: false,
        },
      ],
      totalCalls: 1,
      totalDurationMs: 50,
    };
    const result = toHaveRetrievedNResults(badTrace, 'search', 0);
    expect(result.pass).toBe(true);
  });
});
