import {
  type GroundingOptions,
  type HallucinationOptions,
  type MatcherResult,
  type McpCallSpec,
  type RetrievalScoreOptions,
  type SemanticOverlapOptions,
  type SemanticSimilarityOptions,
  type ToPassJudgeOptions,
  type TrajectoryConfig,
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
  toHaveCalledTool(received: any, name: string, args?: Record<string, unknown>) {
    assertToolTrace(received, 'toHaveCalledTool');
    return adapt(toHaveCalledTool(received, name, args));
  },
  toNotHaveCalledTool(received: any, name: string) {
    assertToolTrace(received, 'toNotHaveCalledTool');
    return adapt(toNotHaveCalledTool(received, name));
  },
  toHaveCalledToolsInOrder(received: any, names: string[]) {
    assertToolTrace(received, 'toHaveCalledToolsInOrder');
    return adapt(toHaveCalledToolsInOrder(received, names));
  },
  toHaveCalledToolsInStrictOrder(received: any, names: string[]) {
    assertToolTrace(received, 'toHaveCalledToolsInStrictOrder');
    return adapt(toHaveCalledToolsInStrictOrder(received, names));
  },
  toHaveToolCallCount(received: any, name: string, count: number) {
    assertToolTrace(received, 'toHaveToolCallCount');
    return adapt(toHaveToolCallCount(received, name, count));
  },
  toHaveFirstCalledTool(received: any, name: string) {
    assertToolTrace(received, 'toHaveFirstCalledTool');
    return adapt(toHaveFirstCalledTool(received, name));
  },
  toHaveLastCalledTool(received: any, name: string) {
    assertToolTrace(received, 'toHaveLastCalledTool');
    return adapt(toHaveLastCalledTool(received, name));
  },

  // Tier 1
  toHaveMarkdownStructure(received: any, spec: any) {
    return adapt(toHaveMarkdownStructure(received, spec));
  },
  toMatchJsonSchema(received: any, schema: any) {
    return adapt(toMatchJsonSchema(received, schema));
  },
  toHaveLineCount(received: any, spec: any) {
    return adapt(toHaveLineCount(received, spec));
  },
  toHaveFileWritten(received: any, path: string, contentMatcher?: string | RegExp) {
    return adapt(toHaveFileWritten(received, path, contentMatcher));
  },

  // Tier 2
  toContain(received: any, pattern: string | RegExp) {
    return adapt(stContain(received, pattern));
  },
  toMention(received: any, term: string, options?: { stem?: boolean }) {
    return adapt(toMention(received, term, options));
  },
  toNotContain(received: any, pattern: string | RegExp) {
    return adapt(toNotContain(received, pattern));
  },
  toContainAll(received: any, patterns: (string | RegExp)[]) {
    return adapt(toContainAll(received, patterns));
  },
  toContainAny(received: any, patterns: (string | RegExp)[]) {
    return adapt(toContainAny(received, patterns));
  },

  // Tier 3
  toBeSemanticallySimilar(received: any, reference: string, options: SemanticSimilarityOptions) {
    return adaptAsync(toBeSemanticallySimilar(received, reference, options));
  },
  toHaveSemanticOverlap(received: any, topics: string[], options: SemanticOverlapOptions) {
    return adaptAsync(toHaveSemanticOverlap(received, topics, options));
  },

  // Tier 4
  toPassJudge(received: any, criteria: string, options?: ToPassJudgeOptions) {
    return adaptAsyncWithJudgeTokens(toPassJudge(received, criteria, options));
  },
  toMatchTrajectory(received: any, config: TrajectoryConfig) {
    return adaptAsyncWithJudgeTokens(toMatchTrajectory(received, config));
  },

  // MCP
  toHaveCalledMcpTool(
    received: any,
    serverName: string,
    toolName: string,
    args?: Record<string, unknown>
  ) {
    assertToolTrace(received, 'toHaveCalledMcpTool');
    return adapt(toHaveCalledMcpTool(received, serverName, toolName, args));
  },
  toHaveCalledMcpServer(received: any, serverName: string) {
    assertToolTrace(received, 'toHaveCalledMcpServer');
    return adapt(toHaveCalledMcpServer(received, serverName));
  },
  toNotHaveCalledMcpTool(received: any, serverName: string, toolName: string) {
    assertToolTrace(received, 'toNotHaveCalledMcpTool');
    return adapt(toNotHaveCalledMcpTool(received, serverName, toolName));
  },
  toHaveCalledMcpToolsInOrder(received: any, calls: McpCallSpec[]) {
    assertToolTrace(received, 'toHaveCalledMcpToolsInOrder');
    return adapt(toHaveCalledMcpToolsInOrder(received, calls));
  },

  // RAG
  toHaveRetrievedDocument(received: any, toolName: string, docMatcher: Record<string, unknown>) {
    assertToolTrace(received, 'toHaveRetrievedDocument');
    return adapt(toHaveRetrievedDocument(received, toolName, docMatcher));
  },
  toHaveRetrievedTopResult(received: any, toolName: string, docMatcher: Record<string, unknown>) {
    assertToolTrace(received, 'toHaveRetrievedTopResult');
    return adapt(toHaveRetrievedTopResult(received, toolName, docMatcher));
  },
  toNotHaveRetrievedDocument(received: any, toolName: string, docMatcher: Record<string, unknown>) {
    assertToolTrace(received, 'toNotHaveRetrievedDocument');
    return adapt(toNotHaveRetrievedDocument(received, toolName, docMatcher));
  },
  toHaveRetrievedNResults(received: any, toolName: string, n: number) {
    assertToolTrace(received, 'toHaveRetrievedNResults');
    return adapt(toHaveRetrievedNResults(received, toolName, n));
  },
  toHaveCitedSources(received: any, sources: string[]) {
    assertToolTrace(received, 'toHaveCitedSources');
    return adapt(toHaveCitedSources(received, sources));
  },

  // RAG Tier 3
  toHaveGroundedResponseIn(
    received: any,
    output: string,
    toolName: string,
    options: GroundingOptions
  ) {
    assertToolTrace(received, 'toHaveGroundedResponseIn');
    return adaptAsync(toHaveGroundedResponseIn(received, output, toolName, options));
  },
  toNotHaveHallucinated(
    received: any,
    output: string,
    toolName: string,
    options: HallucinationOptions
  ) {
    assertToolTrace(received, 'toNotHaveHallucinated');
    return adaptAsync(toNotHaveHallucinated(received, output, toolName, options));
  },
  toHaveRetrievalScore(received: any, toolName: string, options: RetrievalScoreOptions) {
    assertToolTrace(received, 'toHaveRetrievalScore');
    return adaptAsync(toHaveRetrievalScore(received, toolName, options));
  },
};
