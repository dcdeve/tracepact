import { describe, expect, it } from 'vitest';
import {
  toHaveCalledMcpServer,
  toHaveCalledMcpTool,
  toHaveCalledMcpToolsInOrder,
  toNotHaveCalledMcpTool,
} from '../../src/matchers/mcp/index.js';
import { TraceBuilder } from '../../src/trace/trace-builder.js';
import type { ToolTrace } from '../../src/trace/types.js';

function buildTrace(): ToolTrace {
  const b = new TraceBuilder();
  b.addCall({
    toolName: 'read_file',
    args: { path: '/a.txt' },
    result: { type: 'success', content: 'hello' },
    durationMs: 5,
    source: { type: 'local' },
  });
  b.addCall({
    toolName: 'query',
    args: { sql: 'SELECT 1' },
    result: { type: 'success', content: '1' },
    durationMs: 20,
    source: { type: 'mcp', server: 'database' },
  });
  b.addCall({
    toolName: 'list_files',
    args: { dir: '/' },
    result: { type: 'success', content: 'a.txt' },
    durationMs: 10,
    source: { type: 'mcp', server: 'filesystem' },
  });
  b.addCall({
    toolName: 'insert',
    args: { table: 'users', data: { name: 'Alice' } },
    result: { type: 'success', content: 'ok' },
    durationMs: 15,
    source: { type: 'mcp', server: 'database' },
  });
  return b.build();
}

describe('toHaveCalledMcpTool', () => {
  it('passes when MCP tool was called', () => {
    const r = toHaveCalledMcpTool(buildTrace(), 'database', 'query');
    expect(r.pass).toBe(true);
  });

  it('fails when MCP tool was not called', () => {
    const r = toHaveCalledMcpTool(buildTrace(), 'database', 'delete');
    expect(r.pass).toBe(false);
    expect(r.message).toContain('delete');
  });

  it('checks args when provided', () => {
    const r = toHaveCalledMcpTool(buildTrace(), 'database', 'query', { sql: 'SELECT 2' });
    expect(r.pass).toBe(false);
  });

  it('passes with matching args', () => {
    const r = toHaveCalledMcpTool(buildTrace(), 'database', 'query', { sql: 'SELECT 1' });
    expect(r.pass).toBe(true);
  });
});

describe('toHaveCalledMcpServer', () => {
  it('passes when server was called', () => {
    const r = toHaveCalledMcpServer(buildTrace(), 'database');
    expect(r.pass).toBe(true);
  });

  it('fails when server was not called', () => {
    const r = toHaveCalledMcpServer(buildTrace(), 'unknown-server');
    expect(r.pass).toBe(false);
    expect(r.message).toContain('unknown-server');
  });
});

describe('toNotHaveCalledMcpTool', () => {
  it('passes when MCP tool was not called', () => {
    const r = toNotHaveCalledMcpTool(buildTrace(), 'database', 'delete');
    expect(r.pass).toBe(true);
  });

  it('fails when MCP tool was called', () => {
    const r = toNotHaveCalledMcpTool(buildTrace(), 'database', 'query');
    expect(r.pass).toBe(false);
  });
});

describe('toHaveCalledMcpToolsInOrder', () => {
  it('passes with correct cross-server order', () => {
    const r = toHaveCalledMcpToolsInOrder(buildTrace(), [
      { server: 'database', tool: 'query' },
      { server: 'filesystem', tool: 'list_files' },
      { server: 'database', tool: 'insert' },
    ]);
    expect(r.pass).toBe(true);
  });

  it('fails with wrong order', () => {
    const r = toHaveCalledMcpToolsInOrder(buildTrace(), [
      { server: 'filesystem', tool: 'list_files' },
      { server: 'database', tool: 'query' },
    ]);
    expect(r.pass).toBe(false);
  });
});

describe('backward compat — no source', () => {
  it('matchers work gracefully with traces that have no source', () => {
    const b = new TraceBuilder();
    b.addCall({
      toolName: 'read_file',
      args: {},
      result: { type: 'success', content: '' },
      durationMs: 1,
    });
    const trace = b.build();

    expect(toHaveCalledMcpServer(trace, 'any').pass).toBe(false);
    expect(toHaveCalledMcpTool(trace, 'any', 'read_file').pass).toBe(false);
    expect(toNotHaveCalledMcpTool(trace, 'any', 'read_file').pass).toBe(true);
  });
});
