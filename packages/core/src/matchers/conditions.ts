import type { ToolTrace } from '../trace/types.js';
import { matchArgs } from './arg-matcher.js';

export type TraceCondition = (trace: ToolTrace) => boolean;

export function calledTool(name: string): TraceCondition {
  return (trace) => trace.calls.some((c) => c.toolName === name);
}

export function calledToolWith(name: string, args: Record<string, unknown>): TraceCondition {
  return (trace) => trace.calls.some((c) => c.toolName === name && matchArgs(c.args, args).matches);
}

export function calledToolAfter(first: string, second: string): TraceCondition {
  return (trace) => {
    const firstIdx = trace.calls.findIndex((c) => c.toolName === first);
    const secondIdx = trace.calls.findIndex((c) => c.toolName === second);
    return firstIdx >= 0 && secondIdx > firstIdx;
  };
}

export function calledToolTimes(name: string, n: number): TraceCondition {
  return (trace) => trace.calls.filter((c) => c.toolName === name).length === n;
}
