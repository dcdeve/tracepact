/**
 * Compile-time verification that ToolTrace fields are readonly.
 * This file is NOT executed — it only needs to compile (checked by typecheck).
 * If any assignment below stops erroring, the readonly contract is broken.
 */

import type { ToolCall, ToolTrace } from '../src/trace/types.js';

function _verifyReadonly(trace: ToolTrace, call: ToolCall) {
  // @ts-expect-error — calls is readonly
  trace.calls = [];

  // @ts-expect-error — totalCalls is readonly
  trace.totalCalls = 0;

  // @ts-expect-error — totalDurationMs is readonly
  trace.totalDurationMs = 0;

  // @ts-expect-error — toolName is readonly
  call.toolName = 'hack';

  // @ts-expect-error — args is readonly
  call.args = {};

  // @ts-expect-error — sequenceIndex is readonly
  call.sequenceIndex = 99;
}
