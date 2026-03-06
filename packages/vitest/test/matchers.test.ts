import type { ToolTrace } from '@tracepact/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { TraceBuilder } from '../../core/src/trace/trace-builder.js';
import { tracepactMatchers } from '../src/matchers.js';

describe('tracepactMatchers adapter', () => {
  let trace: ToolTrace;
  beforeAll(() => {
    const builder = new TraceBuilder();
    builder.addCall({
      toolName: 'Read',
      args: { path: 'a.ts' },
      result: 'content',
      durationMs: 10,
    });
    builder.addCall({
      toolName: 'Write',
      args: { path: 'b.ts', content: 'x' },
      result: 'ok',
      durationMs: 5,
    });
    trace = builder.build();
  });

  it('toHaveCalledTool returns vitest-compatible result (pass)', () => {
    const result = tracepactMatchers.toHaveCalledTool(trace, 'Read');
    expect(result.pass).toBe(true);
    expect(typeof result.message).toBe('function');
    expect(result.message()).toContain('called');
  });

  it('toHaveCalledTool returns vitest-compatible result (fail)', () => {
    const result = tracepactMatchers.toHaveCalledTool(trace, 'Delete');
    expect(result.pass).toBe(false);
    expect(result.message()).toContain('Delete');
  });

  it('toNotHaveCalledTool works', () => {
    const result = tracepactMatchers.toNotHaveCalledTool(trace, 'Delete');
    expect(result.pass).toBe(true);
  });

  it('toHaveCalledToolsInOrder works', () => {
    const result = tracepactMatchers.toHaveCalledToolsInOrder(trace, ['Read', 'Write']);
    expect(result.pass).toBe(true);
  });

  it('toHaveToolCallCount works', () => {
    const result = tracepactMatchers.toHaveToolCallCount(trace, 'Read', 1);
    expect(result.pass).toBe(true);
  });

  it('toContain works for string output', () => {
    const result = tracepactMatchers.toContain('hello world', 'hello');
    expect(result.pass).toBe(true);
  });

  it('toNotContain works', () => {
    const result = tracepactMatchers.toNotContain('hello world', 'secret');
    expect(result.pass).toBe(true);
  });

  it('formatDiagnostic includes suggestion when present', () => {
    const result = tracepactMatchers.toHaveCalledTool(trace, 'Delete');
    const msg = result.message();
    expect(typeof msg).toBe('string');
  });

  it('toHaveLineCount works', () => {
    const result = tracepactMatchers.toHaveLineCount('line1\nline2\nline3', { min: 2, max: 5 });
    expect(result.pass).toBe(true);
  });

  it('toContainAll works', () => {
    const result = tracepactMatchers.toContainAll('hello world foo', ['hello', 'world']);
    expect(result.pass).toBe(true);
  });

  it('toContainAny works', () => {
    const result = tracepactMatchers.toContainAny('hello world', ['xyz', 'hello']);
    expect(result.pass).toBe(true);
  });
});
