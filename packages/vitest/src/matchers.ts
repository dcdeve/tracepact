import {
  type MatcherResult,
  toContain as stContain,
  toBeSemanticallySimilar,
  toContainAll,
  toContainAny,
  toHaveCalledMcpServer,
  toHaveCalledMcpTool,
  toHaveCalledMcpToolsInOrder,
  toHaveCalledTool,
  toHaveCalledToolsInOrder,
  toHaveCalledToolsInStrictOrder,
  toHaveCitedSources,
  toHaveFileWritten,
  toHaveFirstCalledTool,
  toHaveGroundedResponseIn,
  toHaveLastCalledTool,
  toHaveLineCount,
  toHaveMarkdownStructure,
  toHaveRetrievalScore,
  toHaveRetrievedDocument,
  toHaveRetrievedNResults,
  toHaveRetrievedTopResult,
  toHaveSemanticOverlap,
  toHaveToolCallCount,
  toMatchJsonSchema,
  toMatchTrajectory,
  toMention,
  toNotContain,
  toNotHaveCalledMcpTool,
  toNotHaveCalledTool,
  toNotHaveHallucinated,
  toNotHaveRetrievedDocument,
  toPassJudge,
} from '@tracepact/core';
import { trackUsage } from './token-tracker.js';

function isToolTrace(value: unknown): value is { calls: unknown[]; totalCalls: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'calls' in value &&
    Array.isArray((value as Record<string, unknown>).calls) &&
    'totalCalls' in value
  );
}

function assertToolTrace(received: unknown, matcherName: string): void {
  if (!isToolTrace(received)) {
    const got = received === null ? 'null' : Array.isArray(received) ? 'array' : typeof received;
    throw new TypeError(
      `${matcherName}: expected a ToolTrace, got ${got}. Make sure you are passing the trace returned by your agent runner.`
    );
  }
}

function adapt(result: MatcherResult) {
  return {
    pass: result.pass,
    message: () => formatDiagnostic(result),
    actual: result.diagnostic.received,
    expected: result.diagnostic.expected,
  };
}

async function adaptAsync(result: Promise<MatcherResult>) {
  return adapt(await result);
}

async function adaptAsyncWithJudgeTokens(result: Promise<MatcherResult>) {
  const resolved = await result;
  const tokens = resolved.diagnostic?.tokens ?? 0;
  if (tokens > 0 && process.env.TRACEPACT_LIVE === '1') {
    trackUsage(process.env.TRACEPACT_PROVIDER ?? 'unknown', 'judge', tokens, 0);
  }
  return adapt(resolved);
}

/** Wraps a sync core matcher that does not require a ToolTrace guard. */
function adaptSync<TArgs extends unknown[]>(
  fn: (...args: TArgs) => MatcherResult
): (...args: TArgs) => ReturnType<typeof adapt> {
  return (...args) => adapt(fn(...args));
}

/** Wraps a sync core matcher that requires a ToolTrace as first argument. */
function adaptSyncGuarded<TArgs extends [unknown, ...unknown[]]>(
  fn: (...args: TArgs) => MatcherResult,
  matcherName: string
): (...args: TArgs) => ReturnType<typeof adapt> {
  return (...args) => {
    assertToolTrace(args[0], matcherName);
    return adapt(fn(...args));
  };
}

/** Wraps an async core matcher that does not use judge tokens. */
function adaptAsyncFn<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<MatcherResult>
): (...args: TArgs) => Promise<ReturnType<typeof adapt>> {
  return (...args) => adaptAsync(fn(...args));
}

/** Wraps an async core matcher that requires a ToolTrace as first argument. */
function adaptAsyncFnGuarded<TArgs extends [unknown, ...unknown[]]>(
  fn: (...args: TArgs) => Promise<MatcherResult>,
  matcherName: string
): (...args: TArgs) => Promise<ReturnType<typeof adapt>> {
  return (...args) => {
    assertToolTrace(args[0], matcherName);
    return adaptAsync(fn(...args));
  };
}

/** Wraps an async core matcher that tracks judge token usage. */
function adaptAsyncJudge<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<MatcherResult>
): (...args: TArgs) => Promise<ReturnType<typeof adapt>> {
  return (...args) => adaptAsyncWithJudgeTokens(fn(...args));
}

function formatDiagnostic(r: MatcherResult): string {
  const lines = [r.message];
  if (r.diagnostic.suggestion) {
    lines.push('', r.diagnostic.suggestion);
  }
  if (r.diagnostic.relevantTrace && r.diagnostic.relevantTrace.length > 0) {
    lines.push('', 'Relevant trace:');
    for (const call of r.diagnostic.relevantTrace.slice(0, 5)) {
      const argsPreview = JSON.stringify(call.args).slice(0, 100);
      lines.push(`  ${call.sequenceIndex}. ${call.toolName}(${argsPreview}) → ${call.result.type}`);
    }
  }
  return lines.join('\n');
}

export const tracepactMatchers = {
  // Tier 0
  toHaveCalledTool: adaptSyncGuarded(toHaveCalledTool, 'toHaveCalledTool'),
  toNotHaveCalledTool: adaptSyncGuarded(toNotHaveCalledTool, 'toNotHaveCalledTool'),
  toHaveCalledToolsInOrder: adaptSyncGuarded(toHaveCalledToolsInOrder, 'toHaveCalledToolsInOrder'),
  toHaveCalledToolsInStrictOrder: adaptSyncGuarded(
    toHaveCalledToolsInStrictOrder,
    'toHaveCalledToolsInStrictOrder'
  ),
  toHaveToolCallCount: adaptSyncGuarded(toHaveToolCallCount, 'toHaveToolCallCount'),
  toHaveFirstCalledTool: adaptSyncGuarded(toHaveFirstCalledTool, 'toHaveFirstCalledTool'),
  toHaveLastCalledTool: adaptSyncGuarded(toHaveLastCalledTool, 'toHaveLastCalledTool'),

  // Tier 1
  toHaveMarkdownStructure: adaptSync(toHaveMarkdownStructure),
  toMatchJsonSchema: adaptSync(toMatchJsonSchema),
  toHaveLineCount: adaptSync(toHaveLineCount),
  toHaveFileWritten: adaptSync(toHaveFileWritten),

  // Tier 2
  toContain: adaptSync(stContain),
  toMention: adaptSync(toMention),
  toNotContain: adaptSync(toNotContain),
  toContainAll: adaptSync(toContainAll),
  toContainAny: adaptSync(toContainAny),

  // Tier 3
  toBeSemanticallySimilar: adaptAsyncFn(toBeSemanticallySimilar),
  toHaveSemanticOverlap: adaptAsyncFn(toHaveSemanticOverlap),

  // Tier 4
  toPassJudge: adaptAsyncJudge(toPassJudge),
  toMatchTrajectory: adaptAsyncJudge(toMatchTrajectory),

  // MCP
  toHaveCalledMcpTool: adaptSyncGuarded(toHaveCalledMcpTool, 'toHaveCalledMcpTool'),
  toHaveCalledMcpServer: adaptSyncGuarded(toHaveCalledMcpServer, 'toHaveCalledMcpServer'),
  toNotHaveCalledMcpTool: adaptSyncGuarded(toNotHaveCalledMcpTool, 'toNotHaveCalledMcpTool'),
  toHaveCalledMcpToolsInOrder: adaptSyncGuarded(
    toHaveCalledMcpToolsInOrder,
    'toHaveCalledMcpToolsInOrder'
  ),

  // RAG
  toHaveRetrievedDocument: adaptSyncGuarded(toHaveRetrievedDocument, 'toHaveRetrievedDocument'),
  toHaveRetrievedTopResult: adaptSyncGuarded(toHaveRetrievedTopResult, 'toHaveRetrievedTopResult'),
  toNotHaveRetrievedDocument: adaptSyncGuarded(
    toNotHaveRetrievedDocument,
    'toNotHaveRetrievedDocument'
  ),
  toHaveRetrievedNResults: adaptSyncGuarded(toHaveRetrievedNResults, 'toHaveRetrievedNResults'),
  toHaveCitedSources: adaptSyncGuarded(toHaveCitedSources, 'toHaveCitedSources'),

  // RAG Tier 3
  toHaveGroundedResponseIn: adaptAsyncFnGuarded(
    toHaveGroundedResponseIn,
    'toHaveGroundedResponseIn'
  ),
  toNotHaveHallucinated: adaptAsyncFnGuarded(toNotHaveHallucinated, 'toNotHaveHallucinated'),
  toHaveRetrievalScore: adaptAsyncFnGuarded(toHaveRetrievalScore, 'toHaveRetrievalScore'),
};
