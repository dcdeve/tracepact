// Types
export type { MatcherResult, MatcherContext } from './types.js';
export type { ArgMismatch } from './arg-matcher.js';

// Arg matching engine
export { matchArgs } from './arg-matcher.js';

// Tier 0 — Tool assertions
export {
  toHaveCalledTool,
  toNotHaveCalledTool,
  toHaveCalledToolsInOrder,
  toHaveCalledToolsInStrictOrder,
  toHaveToolCallCount,
  toHaveFirstCalledTool,
  toHaveLastCalledTool,
} from './tier0/index.js';

// Tier 1 — Structural assertions
export {
  toHaveMarkdownStructure,
  toMatchJsonSchema,
  toHaveLineCount,
  toHaveFileWritten,
} from './tier1/index.js';

// Tier 2 — Content assertions
export { toContain, toNotContain, toMention, toContainAll, toContainAny } from './tier2/index.js';

// Tier 3 — Semantic assertions
export {
  toBeSemanticallySimilar,
  toHaveSemanticOverlap,
  clearEmbeddingCache,
  cosineSimilarity,
  EmbeddingCache,
  OpenAIEmbeddingProvider,
  estimateEmbeddingTokens,
} from './tier3/index.js';
export type {
  EmbeddingProvider,
  SemanticSimilarityOptions,
  SemanticOverlapOptions,
} from './tier3/index.js';

// Tier 4 — Judge assertions
export {
  toPassJudge,
  JudgeExecutor,
  buildJudgePrompt,
  loadBundledCalibration,
  loadCustomCalibration,
  toMatchTrajectory,
  buildTraceSummary,
} from './tier4/index.js';
export type {
  ToPassJudgeOptions,
  JudgeConfig,
  JudgeResult,
  JudgeVote,
  CalibrationSet,
  CalibrationExample,
  TrajectoryConfig,
  TrajectoryResult,
} from './tier4/index.js';

// Conditional matchers
export { when } from './when.js';
export type { ConditionalResult } from './when.js';
export {
  calledTool,
  calledToolWith,
  calledToolAfter,
  calledToolTimes,
} from './conditions.js';
export type { TraceCondition } from './conditions.js';

// RAG — Retrieval assertions (Tier 0)
export {
  toHaveRetrievedDocument,
  toHaveRetrievedTopResult,
  toNotHaveRetrievedDocument,
  toHaveRetrievedNResults,
  toHaveCitedSources,
} from './rag/index.js';

// RAG — Semantic retrieval assertions (Tier 3)
export {
  toHaveGroundedResponseIn,
  toNotHaveHallucinated,
  toHaveRetrievalScore,
} from './rag/semantic.js';
export type {
  GroundingOptions,
  HallucinationOptions,
  RetrievalScoreOptions,
} from './rag/semantic.js';

// MCP matchers
export {
  toHaveCalledMcpTool,
  toHaveCalledMcpServer,
  toNotHaveCalledMcpTool,
  toHaveCalledMcpToolsInOrder,
} from './mcp/index.js';
export type { McpCallSpec } from './mcp/index.js';

// Utils
export { tokenizeMarkdown } from './utils/markdown-tokenizer.js';
export type { MarkdownStructure } from './utils/markdown-tokenizer.js';
export { extractJson } from './utils/json-extractor.js';
export { stem } from './utils/stemmer.js';
