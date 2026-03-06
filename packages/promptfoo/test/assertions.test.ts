import type { ToolTrace } from '@tracepact/core';
import { describe, expect, it } from 'vitest';
import {
  assertCalledTool,
  assertCalledToolsInOrder,
  assertNotCalledTool,
  assertOutputContains,
  assertOutputMentions,
  assertToolCallCount,
} from '../src/assertions.js';

function makeTrace(calls: Array<{ toolName: string; args?: Record<string, unknown> }>): ToolTrace {
  return {
    calls: calls.map((c, i) => ({
      toolName: c.toolName,
      args: c.args ?? {},
      result: { type: 'success' as const, content: 'ok' },
      durationMs: 1,
      unknownTool: false,
      sequenceIndex: i,
    })),
    totalCalls: calls.length,
    totalDurationMs: calls.length,
  };
}

function ctx(trace: ToolTrace) {
  return { metadata: { trace } };
}

const emptyTrace = makeTrace([]);
const singleTrace = makeTrace([{ toolName: 'read_file', args: { path: 'a.txt' } }]);
const multiTrace = makeTrace([
  { toolName: 'read_file', args: { path: 'a.txt' } },
  { toolName: 'write_file', args: { path: 'b.txt', content: 'done' } },
  { toolName: 'read_file', args: { path: 'c.txt' } },
]);

describe('assertCalledTool', () => {
  it('passes when tool was called', () => {
    const result = assertCalledTool('output', ctx(singleTrace), 'read_file');
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails when tool was not called', () => {
    const result = assertCalledTool('output', ctx(emptyTrace), 'read_file');
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain('read_file');
  });
});

describe('assertNotCalledTool', () => {
  it('passes when tool was not called', () => {
    const result = assertNotCalledTool('output', ctx(singleTrace), 'write_file');
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails when tool was called', () => {
    const result = assertNotCalledTool('output', ctx(singleTrace), 'read_file');
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });
});

describe('assertCalledToolsInOrder', () => {
  it('passes when tools were called in order', () => {
    const result = assertCalledToolsInOrder('output', ctx(multiTrace), ['read_file', 'write_file']);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails when expected order is not a subsequence', () => {
    // Trace is [read_file, write_file, read_file] — "write_file then read_file then write_file" is not present
    const result = assertCalledToolsInOrder('output', ctx(multiTrace), [
      'write_file',
      'read_file',
      'write_file',
    ]);
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });
});

describe('assertOutputContains', () => {
  it('passes when output matches pattern', () => {
    const result = assertOutputContains('Found SQL injection vulnerability', {}, 'sql injection');
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails when output does not match', () => {
    const result = assertOutputContains('Everything looks fine', {}, 'injection');
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });
});

describe('no trace in context', () => {
  it('all trace assertions fail with helpful message', () => {
    const noCtx = {};
    const r1 = assertCalledTool('out', noCtx, 'read_file');
    expect(r1.pass).toBe(false);
    expect(r1.reason).toContain('No tool trace found');
    expect(r1.reason).toContain('TracePact provider');

    const r2 = assertNotCalledTool('out', noCtx, 'read_file');
    expect(r2.pass).toBe(false);

    const r3 = assertCalledToolsInOrder('out', noCtx, ['read_file']);
    expect(r3.pass).toBe(false);

    const r4 = assertToolCallCount('out', noCtx, 'read_file', 1);
    expect(r4.pass).toBe(false);
  });
});

describe('assertOutputMentions', () => {
  it('passes with stemmed match', () => {
    const result = assertOutputMentions(
      'The vulnerabilities were identified in the codebase',
      {},
      'vulnerability',
      { stem: true }
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });
});
