import { describe, expect, it } from 'vitest';
import { calledTool } from '../../src/matchers/conditions.js';
import type { MatcherResult } from '../../src/matchers/types.js';
import { when } from '../../src/matchers/when.js';
import type { ToolTrace } from '../../src/trace/types.js';

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

const passingMatcher: MatcherResult = {
  pass: true,
  message: 'bash was called safely',
  tier: 0,
  diagnostic: { expected: 'bash', received: 'bash', tokens: 0 },
};

const failingMatcher: MatcherResult = {
  pass: false,
  message: 'bash used dangerous command',
  tier: 0,
  diagnostic: { expected: 'safe command', received: 'rm -rf /', tokens: 0 },
};

describe('when', () => {
  it('runs matcher when condition is met', () => {
    const result = when(trace, calledTool('bash'), passingMatcher);
    expect(result.pass).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.message).toBe('bash was called safely');
  });

  it('skips when condition is not met', () => {
    const result = when(trace, calledTool('delete_file'), failingMatcher);
    expect(result.pass).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.message).toBe('[skipped: condition not met]');
  });

  it('propagates failure when condition is met and matcher fails', () => {
    const result = when(trace, calledTool('bash'), failingMatcher);
    expect(result.pass).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.message).toBe('bash used dangerous command');
  });
});
