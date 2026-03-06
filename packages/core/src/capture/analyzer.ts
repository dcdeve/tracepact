import type { ToolTrace } from '../trace/types.js';

export interface InferredAssertion {
  type: 'calledTool' | 'calledToolWith' | 'calledToolInOrder' | 'notCalledTool' | 'semanticSimilar';
  args: unknown[];
}

export interface TraceAnalysis {
  toolsCalled: string[];
  uniqueTools: string[];
  order: string[];
  toolArgs: Map<string, Record<string, unknown>[]>;
  assertions: InferredAssertion[];
  output: string;
}

export function analyzeTrace(trace: ToolTrace, output: string): TraceAnalysis {
  const toolsCalled = trace.calls.map((c) => c.toolName);
  const uniqueTools = [...new Set(toolsCalled)];
  const toolArgs = new Map<string, Record<string, unknown>[]>();

  for (const call of trace.calls) {
    const existing = toolArgs.get(call.toolName) ?? [];
    existing.push(call.args as Record<string, unknown>);
    toolArgs.set(call.toolName, existing);
  }

  const assertions: InferredAssertion[] = [];

  // Assert each unique tool was called
  for (const tool of uniqueTools) {
    assertions.push({ type: 'calledTool', args: [tool] });
  }

  // Assert tool call order if >1 unique tool
  if (uniqueTools.length > 1) {
    assertions.push({ type: 'calledToolInOrder', args: [toolsCalled] });
  }

  // Assert specific args for tools with interesting arguments
  for (const call of trace.calls) {
    const interestingArgs = extractInterestingArgs(call.args as Record<string, unknown>);
    if (interestingArgs) {
      assertions.push({ type: 'calledToolWith', args: [call.toolName, interestingArgs] });
    }
  }

  return {
    toolsCalled,
    uniqueTools,
    order: toolsCalled,
    toolArgs,
    assertions,
    output,
  };
}

function extractInterestingArgs(args: Record<string, unknown>): Record<string, unknown> | null {
  const interesting: Record<string, unknown> = {};
  let hasAny = false;

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.length > 0 && value.length < 200) {
      // For long string values, use a stringContaining pattern
      if (value.length > 50) {
        const keyword = extractKeyword(value);
        if (keyword) {
          interesting[key] = { __pattern: 'stringContaining', value: keyword };
          hasAny = true;
        }
      } else {
        interesting[key] = value;
        hasAny = true;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      interesting[key] = value;
      hasAny = true;
    }
  }

  return hasAny ? interesting : null;
}

function extractKeyword(text: string): string | null {
  // Extract the most meaningful word (longest non-common word)
  const common = new Set([
    'the',
    'and',
    'for',
    'are',
    'but',
    'not',
    'you',
    'all',
    'can',
    'had',
    'her',
    'was',
    'one',
    'our',
    'out',
    'with',
    'that',
    'this',
    'from',
    'have',
    'been',
  ]);
  const words = text.split(/\s+/).filter((w) => w.length > 3 && !common.has(w.toLowerCase()));
  if (words.length === 0) return null;
  return words.sort((a, b) => b.length - a.length)[0] ?? null;
}
