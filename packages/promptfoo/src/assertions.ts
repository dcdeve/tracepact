import {
  type ToolTrace,
  toContain,
  toHaveCalledTool,
  toHaveCalledToolsInOrder,
  toHaveToolCallCount,
  toMention,
  toNotHaveCalledTool,
} from '@tracepact/core';

export interface PromptfooAssertionResult {
  pass: boolean;
  score: number;
  reason: string;
}

const NO_TRACE = 'No tool trace found. Use the TracePact provider to capture traces.';

/**
 * Extract trace from Promptfoo context (provider metadata).
 */
function getTrace(context: unknown): ToolTrace | null {
  if (context && typeof context === 'object') {
    const ctx = context as Record<string, unknown>;
    const meta = ctx.metadata as Record<string, unknown> | undefined;
    if (meta?.trace) return meta.trace as ToolTrace;
    const vars = ctx.vars as Record<string, unknown> | undefined;
    if (vars?.__trace) return vars.__trace as ToolTrace;
  }
  return null;
}

export function assertCalledTool(
  _output: string,
  context: unknown,
  toolName: string,
  args?: Record<string, unknown>
): PromptfooAssertionResult {
  const trace = getTrace(context);
  if (!trace) return { pass: false, score: 0, reason: NO_TRACE };

  const result = toHaveCalledTool(trace, toolName, args);
  return {
    pass: result.pass,
    score: result.pass ? 1 : 0,
    reason:
      result.message + (result.diagnostic?.suggestion ? ` ${result.diagnostic.suggestion}` : ''),
  };
}

export function assertNotCalledTool(
  _output: string,
  context: unknown,
  toolName: string
): PromptfooAssertionResult {
  const trace = getTrace(context);
  if (!trace) return { pass: false, score: 0, reason: NO_TRACE };

  const result = toNotHaveCalledTool(trace, toolName);
  return { pass: result.pass, score: result.pass ? 1 : 0, reason: result.message };
}

export function assertCalledToolsInOrder(
  _output: string,
  context: unknown,
  toolNames: string[]
): PromptfooAssertionResult {
  const trace = getTrace(context);
  if (!trace) return { pass: false, score: 0, reason: NO_TRACE };

  const result = toHaveCalledToolsInOrder(trace, toolNames);
  return { pass: result.pass, score: result.pass ? 1 : 0, reason: result.message };
}

export function assertToolCallCount(
  _output: string,
  context: unknown,
  toolName: string,
  count: number
): PromptfooAssertionResult {
  const trace = getTrace(context);
  if (!trace) return { pass: false, score: 0, reason: NO_TRACE };

  const result = toHaveToolCallCount(trace, toolName, count);
  return { pass: result.pass, score: result.pass ? 1 : 0, reason: result.message };
}

export function assertOutputContains(
  output: string,
  _context: unknown,
  pattern: string
): PromptfooAssertionResult {
  const result = toContain(output, new RegExp(pattern, 'i'));
  return { pass: result.pass, score: result.pass ? 1 : 0, reason: result.message };
}

export function assertOutputMentions(
  output: string,
  _context: unknown,
  term: string,
  options?: { stem?: boolean }
): PromptfooAssertionResult {
  const result = toMention(output, term, options);
  return { pass: result.pass, score: result.pass ? 1 : 0, reason: result.message };
}
