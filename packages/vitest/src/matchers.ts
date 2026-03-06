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
    return adapt(toHaveCalledTool(received, name, args));
  },
  toNotHaveCalledTool(received: any, name: string) {
    return adapt(toNotHaveCalledTool(received, name));
  },
  toHaveCalledToolsInOrder(received: any, names: string[]) {
    return adapt(toHaveCalledToolsInOrder(received, names));
  },
  toHaveCalledToolsInStrictOrder(received: any, names: string[]) {
    return adapt(toHaveCalledToolsInStrictOrder(received, names));
  },
  toHaveToolCallCount(received: any, name: string, count: number) {
    return adapt(toHaveToolCallCount(received, name, count));
  },
  toHaveFirstCalledTool(received: any, name: string) {
    return adapt(toHaveFirstCalledTool(received, name));
  },
  toHaveLastCalledTool(received: any, name: string) {
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
    return adaptAsync(toPassJudge(received, criteria, options));
  },
  toMatchTrajectory(received: any, config: TrajectoryConfig) {
    return adaptAsync(toMatchTrajectory(received, config));
  },

  // MCP
  toHaveCalledMcpTool(
    received: any,
    serverName: string,
    toolName: string,
    args?: Record<string, unknown>
  ) {
    return adapt(toHaveCalledMcpTool(received, serverName, toolName, args));
  },
  toHaveCalledMcpServer(received: any, serverName: string) {
    return adapt(toHaveCalledMcpServer(received, serverName));
  },
  toNotHaveCalledMcpTool(received: any, serverName: string, toolName: string) {
    return adapt(toNotHaveCalledMcpTool(received, serverName, toolName));
  },
  toHaveCalledMcpToolsInOrder(received: any, calls: McpCallSpec[]) {
    return adapt(toHaveCalledMcpToolsInOrder(received, calls));
  },

  // RAG
  toHaveRetrievedDocument(received: any, toolName: string, docMatcher: Record<string, unknown>) {
    return adapt(toHaveRetrievedDocument(received, toolName, docMatcher));
  },
  toHaveRetrievedTopResult(received: any, toolName: string, docMatcher: Record<string, unknown>) {
    return adapt(toHaveRetrievedTopResult(received, toolName, docMatcher));
  },
  toNotHaveRetrievedDocument(received: any, toolName: string, docMatcher: Record<string, unknown>) {
    return adapt(toNotHaveRetrievedDocument(received, toolName, docMatcher));
  },
  toHaveRetrievedNResults(received: any, toolName: string, n: number) {
    return adapt(toHaveRetrievedNResults(received, toolName, n));
  },
  toHaveCitedSources(received: any, sources: string[]) {
    return adapt(toHaveCitedSources(received, sources));
  },

  // RAG Tier 3
  toHaveGroundedResponseIn(
    received: any,
    output: string,
    toolName: string,
    options: GroundingOptions
  ) {
    return adaptAsync(toHaveGroundedResponseIn(received, output, toolName, options));
  },
  toNotHaveHallucinated(
    received: any,
    output: string,
    toolName: string,
    options: HallucinationOptions
  ) {
    return adaptAsync(toNotHaveHallucinated(received, output, toolName, options));
  },
  toHaveRetrievalScore(received: any, toolName: string, options: RetrievalScoreOptions) {
    return adaptAsync(toHaveRetrievalScore(received, toolName, options));
  },
};
