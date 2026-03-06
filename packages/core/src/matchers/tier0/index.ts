import type { ToolTrace } from '../../trace/types.js';
import { matchArgs } from '../arg-matcher.js';
import type { MatcherResult } from '../types.js';

export function toHaveCalledTool(
  trace: ToolTrace,
  name: string,
  expectedArgs?: Record<string, unknown>
): MatcherResult {
  const matching = trace.calls.filter((c) => c.toolName === name);

  if (matching.length === 0) {
    const allTools = [...new Set(trace.calls.map((c) => c.toolName))];
    return {
      pass: false,
      message: `Expected at least one call to "${name}", but it was never called.`,
      tier: 0,
      diagnostic: {
        expected: { tool: name, args: expectedArgs },
        received: { callsTo: name, count: 0 },
        relevantTrace: trace.calls.slice(0, 10),
        suggestion:
          allTools.length > 0
            ? `Trace contained: [${allTools.map((t) => `"${t}" ×${trace.calls.filter((c) => c.toolName === t).length}`).join(', ')}]`
            : 'Trace is empty — the agent produced no tool calls.',
        tokens: 0,
      },
    };
  }

  if (expectedArgs) {
    const anyMatch = matching.some((c) => matchArgs(c.args, expectedArgs).matches);
    if (!anyMatch) {
      const firstCall = matching[0] as (typeof matching)[0];
      const { mismatches } = matchArgs(firstCall.args, expectedArgs);
      return {
        pass: false,
        message: `"${name}" was called ${matching.length} time(s) but no call matched the expected args.`,
        tier: 0,
        diagnostic: {
          expected: expectedArgs,
          received: firstCall.args,
          relevantTrace: matching,
          suggestion: mismatches
            .map((m) => m.error ?? `Field "${m.field}": expected ${m.expected}, got ${m.received}`)
            .join('. '),
          tokens: 0,
        },
      };
    }
  }

  return {
    pass: true,
    message: `"${name}" was called.`,
    tier: 0,
    diagnostic: { expected: name, received: name, tokens: 0 },
  };
}

export function toNotHaveCalledTool(trace: ToolTrace, name: string): MatcherResult {
  const matching = trace.calls.filter((c) => c.toolName === name);

  if (matching.length > 0) {
    return {
      pass: false,
      message: `Expected "${name}" to never be called, but it was called ${matching.length} time(s).`,
      tier: 0,
      diagnostic: {
        expected: { tool: name, count: 0 },
        received: { count: matching.length },
        relevantTrace: matching,
        suggestion: `First call args: ${JSON.stringify(matching[0]?.args)}`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `"${name}" was not called.`,
    tier: 0,
    diagnostic: { expected: 0, received: 0, tokens: 0 },
  };
}

export function toHaveCalledToolsInOrder(trace: ToolTrace, names: string[]): MatcherResult {
  let searchFrom = 0;

  for (const name of names) {
    const idx = trace.calls.findIndex((c, i) => i >= searchFrom && c.toolName === name);
    if (idx === -1) {
      const actualSequence = trace.calls.map((c) => c.toolName);
      return {
        pass: false,
        message: `Expected tools in order [${names.join(', ')}] but "${name}" was not found after position ${searchFrom}.`,
        tier: 0,
        diagnostic: {
          expected: names,
          received: actualSequence,
          suggestion: `Actual call sequence: [${actualSequence.join(' → ')}]`,
          tokens: 0,
        },
      };
    }
    searchFrom = idx + 1;
  }

  return {
    pass: true,
    message: `Tools called in order: [${names.join(', ')}].`,
    tier: 0,
    diagnostic: { expected: names, received: names, tokens: 0 },
  };
}

export function toHaveCalledToolsInStrictOrder(trace: ToolTrace, names: string[]): MatcherResult {
  if (names.length === 0) {
    return {
      pass: true,
      message: 'Empty sequence matches.',
      tier: 0,
      diagnostic: { expected: names, received: names, tokens: 0 },
    };
  }

  // Find first occurrence of names[0]
  const startIdx = trace.calls.findIndex((c) => c.toolName === names[0]);
  if (startIdx === -1) {
    return {
      pass: false,
      message: `Expected strict sequence [${names.join(', ')}] but "${names[0]}" was not found.`,
      tier: 0,
      diagnostic: {
        expected: names,
        received: trace.calls.map((c) => c.toolName),
        suggestion: `Actual call sequence: [${trace.calls.map((c) => c.toolName).join(' → ')}]`,
        tokens: 0,
      },
    };
  }

  for (let i = 0; i < names.length; i++) {
    const call = trace.calls[startIdx + i];
    if (!call || call.toolName !== names[i]) {
      const actualSlice = trace.calls
        .slice(startIdx, startIdx + names.length)
        .map((c) => c.toolName);
      return {
        pass: false,
        message: `Expected strict sequence [${names.join(', ')}] but found gap or mismatch at position ${i}.`,
        tier: 0,
        diagnostic: {
          expected: names,
          received: actualSlice,
          suggestion: `At position ${i}: expected "${names[i]}", got "${call?.toolName ?? '(end of trace)'}".`,
          tokens: 0,
        },
      };
    }
  }

  return {
    pass: true,
    message: `Tools called in strict order: [${names.join(', ')}].`,
    tier: 0,
    diagnostic: { expected: names, received: names, tokens: 0 },
  };
}

export function toHaveToolCallCount(trace: ToolTrace, name: string, count: number): MatcherResult {
  const actual = trace.calls.filter((c) => c.toolName === name).length;

  if (actual !== count) {
    return {
      pass: false,
      message: `Expected "${name}" to be called ${count} time(s), but it was called ${actual} time(s).`,
      tier: 0,
      diagnostic: {
        expected: { tool: name, count },
        received: { count: actual },
        suggestion:
          actual === 0
            ? `"${name}" was never called.`
            : `Called ${actual} time(s) instead of ${count}.`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `"${name}" was called ${count} time(s).`,
    tier: 0,
    diagnostic: { expected: count, received: count, tokens: 0 },
  };
}

export function toHaveFirstCalledTool(trace: ToolTrace, name: string): MatcherResult {
  if (trace.calls.length === 0) {
    return {
      pass: false,
      message: `Expected first tool call to be "${name}", but trace is empty.`,
      tier: 0,
      diagnostic: {
        expected: name,
        received: '(empty trace)',
        suggestion: 'Trace is empty — the agent produced no tool calls.',
        tokens: 0,
      },
    };
  }

  const firstCall = trace.calls[0] as (typeof trace.calls)[0];
  const first = firstCall.toolName;
  if (first !== name) {
    return {
      pass: false,
      message: `Expected first tool call to be "${name}", but it was "${first}".`,
      tier: 0,
      diagnostic: {
        expected: name,
        received: first,
        suggestion: `First call was "${first}" with args: ${JSON.stringify(firstCall.args)}`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `First tool call was "${name}".`,
    tier: 0,
    diagnostic: { expected: name, received: name, tokens: 0 },
  };
}

export function toHaveLastCalledTool(trace: ToolTrace, name: string): MatcherResult {
  if (trace.calls.length === 0) {
    return {
      pass: false,
      message: `Expected last tool call to be "${name}", but trace is empty.`,
      tier: 0,
      diagnostic: {
        expected: name,
        received: '(empty trace)',
        suggestion: 'Trace is empty — the agent produced no tool calls.',
        tokens: 0,
      },
    };
  }

  const lastCall = trace.calls[trace.calls.length - 1] as (typeof trace.calls)[0];
  const last = lastCall.toolName;
  if (last !== name) {
    return {
      pass: false,
      message: `Expected last tool call to be "${name}", but it was "${last}".`,
      tier: 0,
      diagnostic: {
        expected: name,
        received: last,
        suggestion: `Last call was "${last}" with args: ${JSON.stringify(lastCall.args)}`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `Last tool call was "${name}".`,
    tier: 0,
    diagnostic: { expected: name, received: name, tokens: 0 },
  };
}
