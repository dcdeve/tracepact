# Exported Signatures

<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

> Auto-extracted exported functions and classes

## `packages/cli/src/commands/audit.ts`

```ts
export async function audit(skillPath: string, opts: AuditOptions): Promise<void>
```

## `packages/cli/src/commands/cache.ts`

```ts
export async function cache(subcommand: string, opts: ClearOptions): Promise<void>
```

## `packages/cli/src/commands/capture.ts`

```ts
export async function capture(opts: CaptureOptions): Promise<void>
```

## `packages/cli/src/commands/cost-report.ts`

```ts
export async function costReport(): Promise<void>
```

## `packages/cli/src/commands/diff.ts`

```ts
export async function diff(cassetteA: string, cassetteB: string, opts: DiffOptions): Promise<void>
```

## `packages/cli/src/commands/doctor.ts`

```ts
export async function doctor(): Promise<void>
```

## `packages/cli/src/commands/init.ts`

```ts
export async function init(opts: InitOptions): Promise<void>
```

## `packages/cli/src/commands/models.ts`

```ts
export async function models(providerId: string, opts: ModelsOptions): Promise<void>
```

## `packages/cli/src/commands/run.ts`

```ts
export async function runTests(opts: RunOptions, passthroughArgs: string[]): Promise<void>
```

## `packages/cli/src/index.ts`

```ts
export function createProgram(): Command
```

## `packages/core/src/audit/engine.ts`

```ts
export class AuditEngine {
  constructor(rules: AuditRule[])
  auditSkill(skill: ParsedSkill): AuditReport
  audit(input: AuditInput): AuditReport
}
```

## `packages/core/src/cache/cache-store.ts`

```ts
export class CacheStore {
  constructor(config: CacheConfig, redactionConfig: RedactionConfig)
  async get(manifest: RunManifest): Promise<CacheEntry>
  async set(manifest: RunManifest, result: unknown): Promise<void>
  async list(): Promise<CacheSummary[]>
  async clear(options: { staleOnly: boolean; }): Promise<number>
  async verify(): Promise<{ total: number; valid: number; corrupted: number; expired: number; }>
}
```

## `packages/core/src/cache/run-manifest.ts`

```ts
export function computeManifest(params: { skill: ParsedSkill | { systemPrompt: string; }; prompt: string; tools?: TypedToolDefinition[]; provider: string; model: string; modelVersion?: string; temperature: number; seed?: number; frameworkVersion: string; driverVersion: string; }): RunManifest

export function manifestHash(manifest: RunManifest): string
```

## `packages/core/src/capture/analyzer.ts`

```ts
export function analyzeTrace(trace: ToolTrace, output: string): TraceAnalysis
```

## `packages/core/src/capture/generator.ts`

```ts
export function generateTestFile(analysis: TraceAnalysis, options: GenerateOptions): string
```

## `packages/core/src/cassette/diff.ts`

```ts
export async function diffCassettes(cassettePathA: string, cassettePathB: string, policy: DiffPolicy): Promise<DiffResult>
```

## `packages/core/src/cassette/player.ts`

```ts
export class CassettePlayer {
  constructor(filePath: string, stubs: CassetteStub[], strict: boolean)
  async load(): Promise<Cassette>
  async reload(): Promise<Cassette>
  async replay(currentPrompt: string, currentToolDefsHash: string): Promise<RunResult>
}
```

## `packages/core/src/cassette/recorder.ts`

```ts
export class CassetteRecorder {
  constructor(filePath: string, redactionConfig: RedactionConfig, maxEntrySizeBytes: number)
  async save(result: RunResult, metadata: CassetteMetadata): Promise<void>
}
```

## `packages/core/src/config/define-config.ts`

```ts
export function defineConfig(input: Partial<TracepactConfig>): TracepactConfig
```

## `packages/core/src/cost/accumulator.ts`

```ts
export class TokenAccumulator {
  add(entry: TokenEntry): void
  exceedsBudget(maxTokens: number): boolean
  getReport(): TokenReport
  toJSON(): string
}
```

## `packages/core/src/driver/anthropic-driver.ts`

```ts
export class AnthropicDriver implements AgentDriver {
  constructor(config: { model: string; apiKey?: string; providerName?: string; maxConcurrency?: number; semaphoreTimeoutMs?: number; retry?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; }; })
  async run(input: RunInput): Promise<RunResult>
  async healthCheck(): Promise<HealthCheckResult>
}
```

## `packages/core/src/driver/execute.ts`

```ts
export function clearRegistryCache(): void

export async function executePrompt(skill: string | ParsedSkill | { systemPrompt: string; }, opts: ExecutePromptOptions): Promise<RunResult>
```

## `packages/core/src/driver/openai-driver.ts`

```ts
export class OpenAIDriver implements AgentDriver {
  constructor(config: { model: string; apiKey?: string; baseURL?: string; providerName?: string; maxConcurrency?: number; semaphoreTimeoutMs?: number; retry?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; }; })
  async run(input: RunInput): Promise<RunResult>
  async healthCheck(): Promise<HealthCheckResult>
}
```

## `packages/core/src/driver/registry.ts`

```ts
export function _setRegistryCacheChecker(fn: () => boolean): void

export class DriverRegistry {
  constructor(config: TracepactConfig)
  register(name: string, DriverClass: DriverConstructor): void
  unregister(name: string): void
  getDefault(): AgentDriver
  get(name: string): AgentDriver
  validateAll(): void
  getAll(): Map<string, AgentDriver>
  async healthCheckAll(): Promise<Map<string, HealthCheckResult>>
}
```

## `packages/core/src/driver/resolve.ts`

```ts
export function getDefaultModel(provider: string): string

export function detectProvider(): string

export function resolveConfig(providerName: string, overrides: Partial<TracepactConfig>): TracepactConfig
```

## `packages/core/src/driver/retry-policy.ts`

```ts
export class RetryPolicy {
  constructor(config: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; })
  async execute(fn: () => Promise<T>): Promise<T>
  computeDelay(attempt: number, err: any): number
}
```

## `packages/core/src/driver/semaphore.ts`

```ts
export class Semaphore {
  constructor(max: number, timeoutMs: number)
  async run(fn: () => Promise<T>): Promise<T>
  getQueueLength(): number
}
```

## `packages/core/src/errors/base.ts`

```ts
export class TracepactError extends Error {
  constructor(code: string, message: string, options: ErrorOptions)
}
```

## `packages/core/src/errors/config-error.ts`

```ts
export class ConfigError extends TracepactError {
  constructor(field: string, message: string)
}
```

## `packages/core/src/errors/driver-error.ts`

```ts
export class DriverError extends TracepactError {
  constructor(message: string)
}
```

## `packages/core/src/errors/parse-error.ts`

```ts
export class SkillParseError extends TracepactError {
  constructor(filePath: string, message: string, line: number)
}
```

## `packages/core/src/flake/store.ts`

```ts
export class FlakeStore {
  constructor(path: string)
  async load(): Promise<void>
  record(testId: string, pass: boolean): void
  getScore(testId: string): FlakeScore
  getAllScores(): FlakeScore[]
  async save(): Promise<void>
}
```

## `packages/core/src/logger.ts`

```ts
export function setLogLevel(level: LogLevel): void

export function withLogLevel(level: LogLevel, fn: () => T): T

export function initLogLevelFromEnv(): void
```

## `packages/core/src/matchers/arg-matcher.ts`

```ts
export function matchArgs(actual: Readonly<Record<string, unknown>>, expected: Record<string, unknown>, prefix: string): { matches: boolean; mismatches: ArgMismatch[]; }

export function truncate(str: string, max: number): string
```

## `packages/core/src/matchers/conditions.ts`

```ts
export function calledTool(name: string): TraceCondition

export function calledToolWith(name: string, args: Record<string, unknown>): TraceCondition

export function calledToolAfter(first: string, second: string): TraceCondition

export function calledToolTimes(name: string, n: number): TraceCondition
```

## `packages/core/src/matchers/mcp/index.ts`

```ts
export function toHaveCalledMcpTool(trace: ToolTrace, serverName: string, toolName: string, expectedArgs: Record<string, unknown>): MatcherResult

export function toHaveCalledMcpServer(trace: ToolTrace, serverName: string): MatcherResult

export function toNotHaveCalledMcpTool(trace: ToolTrace, serverName: string, toolName: string): MatcherResult

export function toHaveCalledMcpToolsInOrder(trace: ToolTrace, calls: McpCallSpec[]): MatcherResult
```

## `packages/core/src/matchers/rag/index.ts`

```ts
export function toHaveRetrievedDocument(trace: ToolTrace, toolName: string, docMatcher: Record<string, unknown>): MatcherResult

export function toHaveRetrievedTopResult(trace: ToolTrace, toolName: string, docMatcher: Record<string, unknown>): MatcherResult

export function toNotHaveRetrievedDocument(trace: ToolTrace, toolName: string, docMatcher: Record<string, unknown>): MatcherResult

export function toHaveRetrievedNResults(trace: ToolTrace, toolName: string, n: number): MatcherResult

export function toHaveCitedSources(output: string, sources: string[]): MatcherResult
```

## `packages/core/src/matchers/rag/semantic.ts`

```ts
export async function toHaveGroundedResponseIn(trace: ToolTrace, output: string, toolName: string, options: GroundingOptions): Promise<MatcherResult>

export async function toNotHaveHallucinated(trace: ToolTrace, output: string, toolName: string, options: HallucinationOptions): Promise<MatcherResult>

export async function toHaveRetrievalScore(trace: ToolTrace, toolName: string, options: RetrievalScoreOptions): Promise<MatcherResult>
```

## `packages/core/src/matchers/tier0/index.ts`

```ts
export function toHaveCalledTool(trace: ToolTrace, name: string, expectedArgs: Record<string, unknown>): MatcherResult

export function toNotHaveCalledTool(trace: ToolTrace, name: string): MatcherResult

export function toHaveCalledToolsInOrder(trace: ToolTrace, names: string[]): MatcherResult

export function toHaveCalledToolsInStrictOrder(trace: ToolTrace, names: string[]): MatcherResult

export function toHaveToolCallCount(trace: ToolTrace, name: string, count: number): MatcherResult

export function toHaveFirstCalledTool(trace: ToolTrace, name: string): MatcherResult

export function toHaveLastCalledTool(trace: ToolTrace, name: string): MatcherResult
```

## `packages/core/src/matchers/tier1/index.ts`

```ts
export function toHaveMarkdownStructure(output: string, spec: MarkdownSpec): MatcherResult

export function toMatchJsonSchema(output: string, schema: JsonSchemaSpec): MatcherResult

export function toHaveLineCount(output: string, spec: LineCountSpec): MatcherResult

export function toHaveFileWritten(writesOrTrace: ToolTrace | readonly WriteCapture[], path: string, contentMatcher: string | RegExp, writeToolName: string): MatcherResult
```

## `packages/core/src/matchers/tier2/index.ts`

```ts
export function toContain(output: string, pattern: string | RegExp): MatcherResult

export function toNotContain(output: string, pattern: string | RegExp): MatcherResult

export function toMention(output: string, term: string, options: { stem?: boolean; }): MatcherResult

export function toContainAll(output: string, patterns: (string | RegExp)[]): MatcherResult

export function toContainAny(output: string, patterns: (string | RegExp)[]): MatcherResult
```

## `packages/core/src/matchers/tier3/cosine.ts`

```ts
export function cosineSimilarity(a: number[], b: number[]): number
```

## `packages/core/src/matchers/tier3/embedding-cache.ts`

```ts
export async function embedWithCache(provider: import("/Users/danielcastillo/Documents/projects/tracepact/packages/core/src/matchers/tier3/embeddings").EmbeddingProvider, texts: string[]): Promise<number[][]>

export function clearEmbeddingCache(): void

export class EmbeddingCache {
  get(text: string): number[]
  set(text: string, embedding: number[]): void
  has(text: string): boolean
  clear(): void
}
```

## `packages/core/src/matchers/tier3/embeddings.ts`

```ts
export function estimateEmbeddingTokens(texts: string[]): number

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(apiKey: string, model: string, dimensions: number)
  async embed(texts: string[]): Promise<number[][]>
}
```

## `packages/core/src/matchers/tier3/index.ts`

```ts
export async function toBeSemanticallySimilar(output: string, reference: string, options: SemanticSimilarityOptions): Promise<MatcherResult>

export async function toHaveSemanticOverlap(output: string, topics: string[], options: SemanticOverlapOptions): Promise<MatcherResult>
```

## `packages/core/src/matchers/tier4/calibration.ts`

```ts
export function loadBundledCalibration(name: string): CalibrationSet

export async function loadCustomCalibration(filePath: string): Promise<CalibrationSet>
```

## `packages/core/src/matchers/tier4/index.ts`

```ts
export async function toPassJudge(output: string, criteria: string, options: ToPassJudgeOptions): Promise<MatcherResult>
```

## `packages/core/src/matchers/tier4/judge.ts`

```ts
export function buildJudgePrompt(output: string, criteria: string, calibration: CalibrationSet): string

export class JudgeExecutor {
  constructor(driver: AgentDriver)
  async evaluate(output: string, config: JudgeConfig): Promise<JudgeResult>
}
```

## `packages/core/src/matchers/tier4/trajectory.ts`

```ts
export function buildTraceSummary(trace: ToolTrace): string

export async function toMatchTrajectory(result: { trace: ToolTrace; output: string; }, config: TrajectoryConfig): Promise<TrajectoryResult>
```

## `packages/core/src/matchers/utils/json-extractor.ts`

```ts
export function extractJson(input: string): { json: unknown; raw: string; }
```

## `packages/core/src/matchers/utils/markdown-tokenizer.ts`

```ts
export function tokenizeMarkdown(input: string): MarkdownStructure
```

## `packages/core/src/matchers/utils/stemmer.ts`

```ts
export function stem(word: string): string
```

## `packages/core/src/matchers/when.ts`

```ts
export function when(trace: ToolTrace, condition: TraceCondition, matcherResult: MatcherResult): ConditionalResult
```

## `packages/core/src/mcp/client.ts`

```ts
export class McpClient {
  constructor(config: McpClientConfig)
  async connect(): Promise<void>
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
  async close(): Promise<void>
}
```

## `packages/core/src/mcp/connect.ts`

```ts
export async function connectMcp(config: McpClientConfig): Promise<McpConnection>
```

## `packages/core/src/models/registry.ts`

```ts
export async function refreshModels(): Promise<ProviderInfo[]>

export async function loadProviders(): Promise<ProviderInfo[]>

export async function listProviders(): Promise<(ProviderInfo & { hasKey: boolean; })[]>

export async function listModels(providerId: string): Promise<ModelInfo[]>

export async function getModel(qualifiedId: string): Promise<ModelInfo>

export async function getRecommended(role: "agent" | "judge", preferredProvider: string): Promise<string>

export function hasApiKey(providerId: string): boolean

export function detectAvailableProviders(): string[]

export function resetCache(): void
```

## `packages/core/src/parser/frontmatter-validator.ts`

```ts
export function validateFrontmatter(filePath: string, raw: unknown): { frontmatter: SkillFrontmatter; warnings: string[]; }
```

## `packages/core/src/parser/skill-parser.ts`

```ts
export async function parseSkill(filePath: string): Promise<ParsedSkill>
```

## `packages/core/src/redaction/pipeline.ts`

```ts
export class RedactionPipeline {
  constructor(config: RedactionConfig)
  redact(input: string): string
  redactObject(obj: T): T
}
```

## `packages/core/src/sandbox/container/container-sandbox.ts`

```ts
export class ContainerSandbox implements Sandbox {
  constructor(config: ContainerConfig, docker: DockerClient, mcpServers: Record<string, McpMockServer>)
  async initialize(): Promise<void>
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
  isAllowedPath(path: string): boolean
  isAllowedCommand(command: string): boolean
  getTrace(): ToolTrace
  getWrites(): readonly { path: string; content: string; }[]
  async destroy(): Promise<void>
}
```

## `packages/core/src/sandbox/container/docker-client.ts`

```ts
export function detectRuntime(): "docker" | "podman"

export class DockerClient {
  constructor(runtime: "docker" | "podman")
  getRuntime(): "docker" | "podman"
  async createContainer(config: { image: string; mounts: Array<{ host: string; container: string; }>; network: "none" | "bridge"; limits: { cpu?: string; memory?: string; }; workdir?: string; }): Promise<string>
  async execInContainer(containerId: string, command: string[], timeout: number): Promise<ContainerToolResult>
  async readFile(containerId: string, path: string): Promise<string>
  async writeFile(containerId: string, path: string, content: string): Promise<void>
  async destroyContainer(containerId: string): Promise<void>
  async isAvailable(): Promise<boolean>
  async getVersion(): Promise<string>
}
```

## `packages/core/src/sandbox/container/index.ts`

```ts
export async function createContainerTools(config: import("/Users/danielcastillo/Documents/projects/tracepact/packages/core/src/sandbox/container/types").ContainerConfig): Promise<import("/Users/danielcastillo/Documents/projects/tracepact/packages/core/src/sandbox/container/container-sandbox").ContainerSandbox>
```

## `packages/core/src/sandbox/factories.ts`

```ts
export function createMockTools(defs: MockToolDefs): MockSandbox

export function mockReadFile(files: Record<string, string>): MockToolImpl

export function captureWrites(): MockToolImpl

export function denyAll(): MockToolImpl

export function mockBash(commands: Record<string, MockBashResult>): MockToolImpl

export function passthrough(): MockToolImpl
```

## `packages/core/src/sandbox/glob-utils.ts`

```ts
export function globToRegex(pattern: string): RegExp

export function isAllowedPath(path: string, allowList: string[]): boolean

export function isAllowedCommand(command: string, allowList: (string | RegExp)[]): boolean
```

## `packages/core/src/sandbox/mcp/mcp-mock-server.ts`

```ts
export function createMcpMock(config: McpMockConfig): McpMockServer

export class McpMockServer {
  constructor(config: McpMockConfig)
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult>
  getTrace(): ToolTrace
  reset(): void
}
```

## `packages/core/src/sandbox/mock-sandbox.ts`

```ts
export class MockSandbox implements Sandbox {
  constructor(tools: MockToolDefs, sources: Record<string, ToolCallSource>, writeToolName: string, options: MockSandboxOptions)
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
  getTrace(): ToolTrace
  getWrites(): readonly WriteCapture[]
  reset(): void
}
```

## `packages/core/src/sandbox/process/index.ts`

```ts
export function createProcessTools(config: ProcessSandboxConfig): ProcessSandbox
```

## `packages/core/src/sandbox/process/process-sandbox.ts`

```ts
export class ProcessSandbox implements Sandbox {
  constructor(config: ProcessSandboxConfig)
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
  isAllowedPath(path: string): boolean
  isAllowedCommand(command: string): boolean
  getTrace(): ToolTrace
  getWrites(): readonly { path: string; content: string; }[]
  destroy(): void
}
```

## `packages/core/src/scenarios/loader.ts`

```ts
export function registerScenarioParser(ext: string, parser: ScenarioParser): void

export async function loadScenarios(filePath: string): Promise<Scenario[]>
```

## `packages/core/src/tools/define-tools.ts`

```ts
export function defineTools(defs: T): TypedToolDefinition<string, unknown>[]
```

## `packages/core/src/trace/trace-builder.ts`

```ts
export class TraceBuilder {
  addCall(paramsOrName: string | { toolName: string; args: Record<string, unknown>; result: ToolResult; durationMs: number; unknownTool?: boolean; source?: ToolCallSource; }, args: Record<string, unknown>, resultContent: string): this
  build(): ToolTrace
  reset(): void
}
```

## `packages/mcp-server/src/tools/audit.ts`

```ts
export async function handleAudit(args: { skill_path: string; }): Promise<{ riskLevel: string; pass: boolean; findings: AuditFinding[]; summary: { critical: number; high: number; medium: number; low: number; total: number; }; }>
```

## `packages/mcp-server/src/tools/capture.ts`

```ts
export async function handleCapture(args: { skill_path: string; prompt: string; cassette_path?: string | undefined; }): Promise<{ testFile: string; cassettePath: string; assertionsGenerated: number; error?: string; }>
```

## `packages/mcp-server/src/tools/diff.ts`

```ts
export async function handleDiff(args: { cassette_a: string; cassette_b: string; ignore_keys?: string[] | undefined; ignore_tools?: string[] | undefined; }): Promise<DiffResult>
```

## `packages/mcp-server/src/tools/list-tests.ts`

```ts
export function handleListTests(args: { skill_path: string; }): { tests: TestFile[]; cassettes: CassetteFile[]; }
```

## `packages/mcp-server/src/tools/replay.ts`

```ts
export function handleReplay(args: { cassette_path: string; }): { pass: boolean; trace: Record<string, unknown>; error?: string; }
```

## `packages/mcp-server/src/tools/run.ts`

```ts
export async function handleRun(args: { skill_path: string; live?: boolean | undefined; provider?: string | undefined; budget?: number | undefined; }): Promise<{ pass: boolean; output: string; error?: string; }>
```

## `packages/promptfoo/src/assertions.ts`

```ts
export function assertCalledTool(_output: string, context: unknown, toolName: string, args: Record<string, unknown>): PromptfooAssertionResult

export function assertNotCalledTool(_output: string, context: unknown, toolName: string): PromptfooAssertionResult

export function assertCalledToolsInOrder(_output: string, context: unknown, toolNames: string[]): PromptfooAssertionResult

export function assertToolCallCount(_output: string, context: unknown, toolName: string, count: number): PromptfooAssertionResult

export function assertOutputContains(output: string, _context: unknown, pattern: string): PromptfooAssertionResult

export function assertOutputMentions(output: string, _context: unknown, term: string, options: { stem?: boolean; }): PromptfooAssertionResult
```

## `packages/promptfoo/src/provider.ts`

```ts
export class TracepactProvider {
  constructor(config: TracepactProviderConfig)
  id(): string
  async callApi(prompt: string): Promise<ProviderResponse>
}
```

## `packages/vitest/src/json-reporter.ts`

```ts
export class TracepactJsonReporter implements Reporter {
  constructor(redactionConfig: RedactionConfig)
  onFinished(files: import("/Users/danielcastillo/Documents/projects/tracepact/node_modules/vitest/dist/index").RunnerTestFile[]): void
}
```

## `packages/vitest/src/plugin.ts`

```ts
export function tracepactPlugin(): Plugin<any>
```

## `packages/vitest/src/run-skill.ts`

```ts
export async function _closePendingMcpConnections(): Promise<void>

export async function runSkill(skill: any, input: RunSkillOptions): Promise<RunResult>
```

## `packages/vitest/src/token-tracker.ts`

```ts
export function trackUsage(provider: string, model: string, inputTokens: number, outputTokens: number, runTokens: TokenAccumulator): void

export function writeTokenReport(): void
```
<!-- END:GENERATED -->
