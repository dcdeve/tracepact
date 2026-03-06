import type { WriteCapture } from '../sandbox/types.js';
import type { ToolCall } from '../trace/types.js';

export interface MatcherResult {
  pass: boolean;
  message: string;
  tier: 0 | 1 | 2 | 3 | 4;
  diagnostic: {
    expected: unknown;
    received: unknown;
    relevantTrace?: ToolCall[];
    suggestion?: string;
    tokens: number;
  };
}

export interface MatcherContext {
  trace: import('../trace/types.js').ToolTrace;
  output: string;
  writes: ReadonlyArray<WriteCapture>;
}
