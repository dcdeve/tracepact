import { describe, expect, it } from 'vitest';
import { TraceBuilder } from '../../src/trace/trace-builder.js';

describe('ToolCall.source', () => {
  it('trace without source is backward compatible', () => {
    const builder = new TraceBuilder();
    builder.addCall({
      toolName: 'read_file',
      args: { path: '/test' },
      result: { type: 'success', content: 'ok' },
      durationMs: 10,
    });
    const trace = builder.build();
    expect(trace.calls[0]?.source).toBeUndefined();
    expect(trace.totalCalls).toBe(1);
  });

  it('trace with local source', () => {
    const builder = new TraceBuilder();
    builder.addCall({
      toolName: 'bash',
      args: { command: 'echo hi' },
      result: { type: 'success', content: 'hi' },
      durationMs: 5,
      source: { type: 'local' },
    });
    const trace = builder.build();
    expect(trace.calls[0]?.source).toEqual({ type: 'local' });
  });

  it('trace with mcp source', () => {
    const builder = new TraceBuilder();
    builder.addCall({
      toolName: 'query_db',
      args: { sql: 'SELECT 1' },
      result: { type: 'success', content: '1' },
      durationMs: 50,
      source: { type: 'mcp', server: 'database' },
    });
    builder.addCall({
      toolName: 'list_files',
      args: { dir: '/' },
      result: { type: 'success', content: 'a.txt\nb.txt' },
      durationMs: 20,
      source: { type: 'mcp', server: 'filesystem', uri: 'file:///' },
    });
    const trace = builder.build();
    expect(trace.totalCalls).toBe(2);

    const call0 = trace.calls[0];
    expect(call0?.source).toEqual({ type: 'mcp', server: 'database' });

    const call1 = trace.calls[1];
    expect(call1?.source).toEqual({ type: 'mcp', server: 'filesystem', uri: 'file:///' });
  });
});
