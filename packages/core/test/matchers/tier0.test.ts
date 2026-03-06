import { describe, expect, it } from 'vitest';
import {
  toHaveCalledTool,
  toHaveCalledToolsInOrder,
  toHaveCalledToolsInStrictOrder,
  toHaveFirstCalledTool,
  toHaveLastCalledTool,
  toHaveToolCallCount,
  toNotHaveCalledTool,
} from '../../src/matchers/tier0/index.js';
import { TraceBuilder } from '../../src/trace/trace-builder.js';

function buildTrace(calls: Array<{ name: string; args?: Record<string, unknown> }>) {
  const builder = new TraceBuilder();
  for (const c of calls) {
    builder.addCall({
      toolName: c.name,
      args: c.args ?? {},
      result: { type: 'success', content: 'ok' },
      durationMs: 1,
    });
  }
  return builder.build();
}

const emptyTrace = buildTrace([]);
const abcTrace = buildTrace([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
const readTrace = buildTrace([{ name: 'read_file', args: { path: 'a.ts' } }]);

describe('toHaveCalledTool', () => {
  it('passes when tool exists', () => {
    expect(toHaveCalledTool(readTrace, 'read_file').pass).toBe(true);
  });

  it('fails when tool missing', () => {
    const r = toHaveCalledTool(abcTrace, 'read_file');
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('Trace contained');
  });

  it('passes with matching args', () => {
    expect(toHaveCalledTool(readTrace, 'read_file', { path: 'a.ts' }).pass).toBe(true);
  });

  it('fails with mismatched args', () => {
    const r = toHaveCalledTool(readTrace, 'read_file', { path: 'b.ts' });
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('path');
  });

  it('passes with regex arg match', () => {
    expect(toHaveCalledTool(readTrace, 'read_file', { path: /\.ts$/ }).pass).toBe(true);
  });

  it('fails regex on non-string arg', () => {
    const trace = buildTrace([{ name: 'tool', args: { count: 5 } }]);
    const r = toHaveCalledTool(trace, 'tool', { count: /5/ });
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('Cannot apply regex');
  });

  it('passes with partial match (extra fields OK)', () => {
    const trace = buildTrace([{ name: 'write_file', args: { path: 'a', content: 'b' } }]);
    expect(toHaveCalledTool(trace, 'write_file', { path: 'a' }).pass).toBe(true);
  });

  it('fails on empty trace', () => {
    const r = toHaveCalledTool(emptyTrace, 'read_file');
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('Trace is empty');
  });
});

describe('toNotHaveCalledTool', () => {
  it('passes when tool not called', () => {
    expect(toNotHaveCalledTool(readTrace, 'write_file').pass).toBe(true);
  });

  it('fails when tool was called', () => {
    const r = toNotHaveCalledTool(readTrace, 'read_file');
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('First call args');
  });
});

describe('toHaveCalledToolsInOrder', () => {
  it('passes with correct order (gaps allowed)', () => {
    expect(toHaveCalledToolsInOrder(abcTrace, ['A', 'C']).pass).toBe(true);
  });

  it('fails with wrong order', () => {
    const r = toHaveCalledToolsInOrder(abcTrace, ['C', 'A']);
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('Actual call sequence');
  });
});

describe('toHaveCalledToolsInStrictOrder', () => {
  it('passes with strict adjacent sequence', () => {
    expect(toHaveCalledToolsInStrictOrder(abcTrace, ['A', 'B']).pass).toBe(true);
  });

  it('fails with gap between tools', () => {
    const r = toHaveCalledToolsInStrictOrder(abcTrace, ['A', 'C']);
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('expected "C"');
  });
});

describe('toHaveToolCallCount', () => {
  it('passes with exact count', () => {
    const trace = buildTrace([{ name: 'A' }, { name: 'A' }, { name: 'B' }]);
    expect(toHaveToolCallCount(trace, 'A', 2).pass).toBe(true);
  });

  it('fails with wrong count', () => {
    const r = toHaveToolCallCount(abcTrace, 'A', 2);
    expect(r.pass).toBe(false);
    expect(r.message).toContain('1 time(s)');
  });
});

describe('toHaveFirstCalledTool', () => {
  it('passes when first tool matches', () => {
    expect(toHaveFirstCalledTool(abcTrace, 'A').pass).toBe(true);
  });

  it('fails when first tool differs', () => {
    const r = toHaveFirstCalledTool(abcTrace, 'B');
    expect(r.pass).toBe(false);
    expect(r.diagnostic.received).toBe('A');
  });
});

describe('toHaveLastCalledTool', () => {
  it('passes when last tool matches', () => {
    expect(toHaveLastCalledTool(abcTrace, 'C').pass).toBe(true);
  });

  it('fails on empty trace', () => {
    const r = toHaveLastCalledTool(emptyTrace, 'A');
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('Trace is empty');
  });
});
