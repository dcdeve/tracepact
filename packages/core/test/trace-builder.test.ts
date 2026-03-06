import { describe, expect, it } from 'vitest';
import { TraceBuilder } from '../src/trace/trace-builder.js';
import type { ToolResult } from '../src/trace/types.js';

const successResult: ToolResult = { type: 'success', content: 'ok' };
const errorResult: ToolResult = { type: 'error', message: 'fail' };

describe('TraceBuilder', () => {
  it('builds an empty trace', () => {
    const builder = new TraceBuilder();
    const trace = builder.build();

    expect(trace.totalCalls).toBe(0);
    expect(trace.calls).toHaveLength(0);
    expect(trace.totalDurationMs).toBe(0);
  });

  it('builds a trace with a single call', () => {
    const builder = new TraceBuilder();
    builder.addCall({
      toolName: 'read_file',
      args: { path: '/tmp/test.txt' },
      result: successResult,
      durationMs: 100,
    });

    const trace = builder.build();
    expect(trace.totalCalls).toBe(1);
    expect(trace.calls[0]?.toolName).toBe('read_file');
    expect(trace.calls[0]?.sequenceIndex).toBe(0);
    expect(trace.calls[0]?.unknownTool).toBe(false);
    expect(trace.calls[0]?.args).toEqual({ path: '/tmp/test.txt' });
    expect(trace.calls[0]?.result).toEqual(successResult);
  });

  it('builds a trace with multiple calls and correct sequence indices', () => {
    const builder = new TraceBuilder();
    builder.addCall({ toolName: 'a', args: {}, result: successResult, durationMs: 10 });
    builder.addCall({ toolName: 'b', args: {}, result: successResult, durationMs: 20 });
    builder.addCall({ toolName: 'c', args: {}, result: errorResult, durationMs: 30 });

    const trace = builder.build();
    expect(trace.totalCalls).toBe(3);
    expect(trace.calls[0]?.sequenceIndex).toBe(0);
    expect(trace.calls[1]?.sequenceIndex).toBe(1);
    expect(trace.calls[2]?.sequenceIndex).toBe(2);
    expect(trace.totalDurationMs).toBe(60);
  });

  it('sets unknownTool flag when specified', () => {
    const builder = new TraceBuilder();
    builder.addCall({
      toolName: 'unknown_tool',
      args: {},
      result: errorResult,
      durationMs: 5,
      unknownTool: true,
    });

    const trace = builder.build();
    expect(trace.calls[0]?.unknownTool).toBe(true);
  });

  it('produces a frozen (immutable) trace', () => {
    const builder = new TraceBuilder();
    builder.addCall({ toolName: 'a', args: {}, result: successResult, durationMs: 10 });
    const trace = builder.build();

    expect(Object.isFrozen(trace)).toBe(true);
    expect(Object.isFrozen(trace.calls)).toBe(true);
    expect(() => {
      (trace.calls as any).push({ toolName: 'hack' });
    }).toThrow();
  });

  it('resets to empty state', () => {
    const builder = new TraceBuilder();
    builder.addCall({ toolName: 'a', args: {}, result: successResult, durationMs: 10 });
    builder.addCall({ toolName: 'b', args: {}, result: successResult, durationMs: 20 });
    builder.reset();

    const trace = builder.build();
    expect(trace.totalCalls).toBe(0);
    expect(trace.calls).toHaveLength(0);
    expect(trace.totalDurationMs).toBe(0);
  });

  it('resets sequence index after reset', () => {
    const builder = new TraceBuilder();
    builder.addCall({ toolName: 'a', args: {}, result: successResult, durationMs: 10 });
    builder.reset();
    builder.addCall({ toolName: 'b', args: {}, result: successResult, durationMs: 20 });

    const trace = builder.build();
    expect(trace.calls[0]?.sequenceIndex).toBe(0);
  });
});
