import { describe, expect, it } from 'vitest';
import { analyzeTrace } from '../../src/capture/analyzer.js';
import type { ToolTrace } from '../../src/trace/types.js';

describe('analyzeTrace', () => {
  it('analyzes a simple single-tool trace', () => {
    const trace: ToolTrace = {
      calls: [
        {
          toolName: 'bash',
          args: { command: 'npm run build' },
          result: { type: 'success', content: 'ok' },
          durationMs: 500,
          sequenceIndex: 0,
          unknownTool: false,
        },
      ],
      totalCalls: 1,
      totalDurationMs: 500,
    };

    const analysis = analyzeTrace(trace, 'Build complete.');
    expect(analysis.uniqueTools).toEqual(['bash']);
    expect(analysis.toolsCalled).toEqual(['bash']);
    expect(analysis.output).toBe('Build complete.');

    const calledToolAssertions = analysis.assertions.filter((a) => a.type === 'calledTool');
    expect(calledToolAssertions).toHaveLength(1);
    expect(calledToolAssertions[0]?.args[0]).toBe('bash');

    // No order assertion for single tool
    const orderAssertions = analysis.assertions.filter((a) => a.type === 'calledToolInOrder');
    expect(orderAssertions).toHaveLength(0);
  });

  it('analyzes a multi-tool trace with order', () => {
    const trace: ToolTrace = {
      calls: [
        {
          toolName: 'read_file',
          args: { path: '/config.yaml' },
          result: { type: 'success', content: 'port: 3000' },
          durationMs: 10,
          sequenceIndex: 0,
          unknownTool: false,
        },
        {
          toolName: 'bash',
          args: { command: 'npm run build' },
          result: { type: 'success', content: 'ok' },
          durationMs: 500,
          sequenceIndex: 1,
          unknownTool: false,
        },
        {
          toolName: 'write_file',
          args: { path: '/output.log', content: 'done' },
          result: { type: 'success', content: 'ok' },
          durationMs: 5,
          sequenceIndex: 2,
          unknownTool: false,
        },
      ],
      totalCalls: 3,
      totalDurationMs: 515,
    };

    const analysis = analyzeTrace(trace, 'Deploy complete.');
    expect(analysis.uniqueTools).toEqual(['read_file', 'bash', 'write_file']);

    // Should have order assertion
    const orderAssertions = analysis.assertions.filter((a) => a.type === 'calledToolInOrder');
    expect(orderAssertions).toHaveLength(1);
    expect(orderAssertions[0]?.args[0]).toEqual(['read_file', 'bash', 'write_file']);

    // Should have calledToolWith for args
    const withAssertions = analysis.assertions.filter((a) => a.type === 'calledToolWith');
    expect(withAssertions.length).toBeGreaterThan(0);
  });

  it('handles empty trace', () => {
    const trace: ToolTrace = {
      calls: [],
      totalCalls: 0,
      totalDurationMs: 0,
    };

    const analysis = analyzeTrace(trace, '');
    expect(analysis.uniqueTools).toEqual([]);
    expect(analysis.assertions).toEqual([]);
  });
});
