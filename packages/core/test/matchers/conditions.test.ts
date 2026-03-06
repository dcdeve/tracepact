import { describe, expect, it } from 'vitest';
import {
  calledTool,
  calledToolAfter,
  calledToolTimes,
  calledToolWith,
} from '../../src/matchers/conditions.js';
import type { ToolTrace } from '../../src/trace/types.js';

const trace: ToolTrace = {
  calls: [
    {
      toolName: 'read_file',
      args: { path: '/app/config.yaml' },
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
      args: { path: '/app/output.log', content: 'done' },
      result: { type: 'success', content: 'ok' },
      durationMs: 5,
      sequenceIndex: 2,
      unknownTool: false,
    },
  ],
  totalCalls: 3,
  totalDurationMs: 515,
};

describe('calledTool', () => {
  it('returns true when tool was called', () => {
    expect(calledTool('bash')(trace)).toBe(true);
  });

  it('returns false when tool was not called', () => {
    expect(calledTool('delete_file')(trace)).toBe(false);
  });
});

describe('calledToolWith', () => {
  it('returns true when tool called with matching args', () => {
    expect(calledToolWith('bash', { command: 'npm run build' })(trace)).toBe(true);
  });

  it('returns false when args do not match', () => {
    expect(calledToolWith('bash', { command: 'rm -rf /' })(trace)).toBe(false);
  });
});

describe('calledToolAfter', () => {
  it('returns true when second tool called after first', () => {
    expect(calledToolAfter('read_file', 'bash')(trace)).toBe(true);
  });

  it('returns false when order is reversed', () => {
    expect(calledToolAfter('bash', 'read_file')(trace)).toBe(false);
  });

  it('returns false when tool not present', () => {
    expect(calledToolAfter('read_file', 'delete_file')(trace)).toBe(false);
  });
});

describe('calledToolTimes', () => {
  it('returns true when count matches', () => {
    expect(calledToolTimes('bash', 1)(trace)).toBe(true);
  });

  it('returns false when count does not match', () => {
    expect(calledToolTimes('bash', 2)(trace)).toBe(false);
  });
});
