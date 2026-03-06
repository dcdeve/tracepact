import type { ToolTrace } from '../trace/types.js';
import type { TraceCondition } from './conditions.js';
import type { MatcherResult } from './types.js';

export interface ConditionalResult extends MatcherResult {
  skipped: boolean;
}

export function when(
  trace: ToolTrace,
  condition: TraceCondition,
  matcherResult: MatcherResult
): ConditionalResult {
  if (condition(trace)) {
    return { ...matcherResult, skipped: false };
  }

  return {
    pass: true,
    message: '[skipped: condition not met]',
    tier: matcherResult.tier,
    diagnostic: {
      expected: matcherResult.diagnostic.expected,
      received: 'condition not met — assertion skipped',
      tokens: 0,
    },
    skipped: true,
  };
}
