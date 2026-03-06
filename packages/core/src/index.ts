// Config
export { defineConfig } from './config/define-config.js';
export type {
  TracepactConfig,
  ProviderConfig,
  ModelRoles,
  RetryConfig,
  CacheConfig,
  RedactionConfig,
  RedactionRule,
} from './config/types.js';

// Parser
export { parseSkill } from './parser/skill-parser.js';
export type { ParsedSkill, SkillFrontmatter } from './parser/types.js';

// Trace
export type { ToolTrace, ToolCall, ToolCallSource, ToolResult } from './trace/types.js';
export { TraceBuilder } from './trace/trace-builder.js';

// Tools
export { defineTools } from './tools/define-tools.js';
export type { TypedToolDefinition, ToolDefs } from './tools/types.js';

// Redaction
export { RedactionPipeline } from './redaction/pipeline.js';

// Sandbox
export { MockSandbox } from './sandbox/mock-sandbox.js';
export {
  createMockTools,
  mockReadFile,
  captureWrites,
  mockWriteFile,
  denyAll,
  mockBash,
  passthrough,
} from './sandbox/factories.js';
export type { MockToolImpl, MockToolDefs, WriteCapture, MockBashResult } from './sandbox/types.js';

// Container Sandbox
export {
  ContainerSandbox,
  DockerClient,
  createContainerTools,
  detectRuntime,
} from './sandbox/container/index.js';
export type { ContainerConfig, ContainerToolResult } from './sandbox/container/index.js';

// Process Sandbox
export { ProcessSandbox, createProcessTools } from './sandbox/process/index.js';
export type { ProcessSandboxConfig } from './sandbox/process/index.js';

// MCP Mock
export { McpMockServer, createMcpMock } from './sandbox/mcp/index.js';
export type { McpMockConfig, McpToolHandler } from './sandbox/mcp/index.js';

// Cache
export { CacheStore } from './cache/cache-store.js';
export { computeManifest, manifestHash } from './cache/run-manifest.js';
export type { RunManifest } from './cache/run-manifest.js';
export type { CacheEntry, CacheSummary } from './cache/cache-store.js';

// Driver
export { RetryPolicy } from './driver/retry-policy.js';
export { Semaphore } from './driver/semaphore.js';
export { OpenAIDriver } from './driver/openai-driver.js';
export { AnthropicDriver } from './driver/anthropic-driver.js';
export { DriverRegistry } from './driver/registry.js';
export { detectProvider, resolveConfig, getDefaultModel } from './driver/resolve.js';
export { executePrompt, type ExecutePromptOptions } from './driver/execute.js';
export { PROVIDER_PRESETS, PROVIDER_ENV_KEYS, type ProviderPreset } from './driver/presets.js';
export type {
  AgentDriver,
  RunInput,
  RunResult,
  RunConfig,
  UsageInfo,
  Message,
  ContentBlock,
  DriverCapabilities,
  HealthCheckResult,
} from './driver/types.js';

// Matchers
export type { MatcherResult, MatcherContext, ArgMismatch } from './matchers/index.js';
export {
  matchArgs,
  toHaveCalledTool,
  toNotHaveCalledTool,
  toHaveCalledToolsInOrder,
  toHaveCalledToolsInStrictOrder,
  toHaveToolCallCount,
  toHaveFirstCalledTool,
  toHaveLastCalledTool,
  toHaveMarkdownStructure,
  toMatchJsonSchema,
  toHaveLineCount,
  toHaveFileWritten,
  toContain,
  toNotContain,
  toMention,
  toContainAll,
  toContainAny,
  toBeSemanticallySimilar,
  toHaveSemanticOverlap,
  clearEmbeddingCache,
  cosineSimilarity,
  EmbeddingCache,
  OpenAIEmbeddingProvider,
  estimateEmbeddingTokens,
  toPassJudge,
  JudgeExecutor,
  buildJudgePrompt,
  loadBundledCalibration,
  loadCustomCalibration,
  toMatchTrajectory,
  buildTraceSummary,
  when,
  calledTool,
  calledToolWith,
  calledToolAfter,
  calledToolTimes,
  tokenizeMarkdown,
  extractJson,
  stem,
  toHaveRetrievedDocument,
  toHaveRetrievedTopResult,
  toNotHaveRetrievedDocument,
  toHaveRetrievedNResults,
  toHaveCitedSources,
  toHaveGroundedResponseIn,
  toNotHaveHallucinated,
  toHaveRetrievalScore,
  toHaveCalledMcpTool,
  toHaveCalledMcpServer,
  toNotHaveCalledMcpTool,
  toHaveCalledMcpToolsInOrder,
} from './matchers/index.js';
export type {
  GroundingOptions,
  HallucinationOptions,
  RetrievalScoreOptions,
  MarkdownStructure,
  EmbeddingProvider,
  SemanticSimilarityOptions,
  SemanticOverlapOptions,
  ToPassJudgeOptions,
  JudgeConfig,
  JudgeResult,
  JudgeVote,
  CalibrationSet,
  CalibrationExample,
  TrajectoryConfig,
  TrajectoryResult,
  ConditionalResult,
  TraceCondition,
  McpCallSpec,
} from './matchers/index.js';

// Capture
export { analyzeTrace } from './capture/analyzer.js';
export { generateTestFile } from './capture/generator.js';
export type { InferredAssertion, TraceAnalysis } from './capture/analyzer.js';
export type { GenerateOptions } from './capture/generator.js';

// Cassettes
export { CassetteRecorder } from './cassette/recorder.js';
export { CassettePlayer } from './cassette/player.js';
export type {
  Cassette,
  CassetteMetadata,
  CassetteResult,
  CassetteToolCall,
  CassetteStub,
} from './cassette/types.js';

// Tokens
export { TokenAccumulator, type TokenEntry, type TokenReport } from './cost/accumulator.js';

// Scenarios
export { loadScenarios, type Scenario } from './scenarios/loader.js';

// Flake
export { FlakeStore } from './flake/store.js';
export type { FlakeEntry, FlakeScore } from './flake/store.js';

// Audit
export {
  AuditEngine,
  BUILTIN_RULES,
  toolComboRisk,
  promptHygiene,
  skillCompleteness,
  noOpaqueTools,
} from './audit/index.js';
export type {
  AuditFinding,
  AuditInput,
  AuditReport,
  AuditRule,
  AuditSeverity,
} from './audit/index.js';

// Models
export {
  loadProviders,
  listProviders,
  listModels,
  getModel,
  getRecommended,
  refreshModels,
  hasApiKey,
  detectAvailableProviders,
  resetCache,
} from './models/registry.js';
export type { ModelInfo, ProviderInfo, ModelRole, EmbeddingModelInfo } from './models/types.js';
export { EMBEDDING_MODELS, DEFAULT_EMBEDDING_MODEL } from './models/embeddings.js';
export { SNAPSHOT_PROVIDERS } from './models/snapshot.js';

// Errors
export { TracepactError } from './errors/base.js';
export { SkillParseError } from './errors/parse-error.js';
export { ConfigError } from './errors/config-error.js';
export { DriverError } from './errors/driver-error.js';

// Logger
export { log, setLogLevel } from './logger.js';
