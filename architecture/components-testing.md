> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Componentes del core de testing — sandbox, matchers (Tier 0–4), cassettes y cache
> **Índice general:** [index.md](./index.md)

# Architectural Components — Testing Core

Otros grupos de componentes: [components-drivers.md](./components-drivers.md) · [components-tooling.md](./components-tooling.md)

---

### `MockSandbox`

- **Ubicación:** `packages/core/src/sandbox/`
- **Clasificación:** core domain
- **Responsabilidad:** Acts as the isolated tool execution environment during tests. All tool calls from the driver are routed through the sandbox instead of real infrastructure.
- **Depende de:** `TraceBuilder`, `MockToolDefs`
- **Dependencias externas:** none
- **Consumido por:** `executePrompt()` (`driver/execute.ts`), `runSkill()` (`packages/vitest`), `TracepactProvider` (`packages/promptfoo`), CLI `capture` command
- **Entradas:** tool name + args from driver
- **Salidas:** `ToolResult` (success string or error), populates `ToolTrace`
- **Estado interno:** stateful — accumulates `ToolTrace` and `WriteCapture[]` during run
- **Observaciones:** `[OBSERVED]` The sandbox is reset between runs via `reset()`. `[OBSERVED]` `passthrough()` returns `{ type: 'success', content: '' }` — a no-op that silently succeeds without forwarding to any real implementation. `[OBSERVED]` The tool name tracked for `WriteCapture` defaults to `'write_file'` but is configurable via the third constructor parameter — useful when the write tool has a different name.

#### Firmas relevantes

```typescript
class MockSandbox {
  constructor(tools: MockToolDefs, sources?: Record<string, ToolCallSource>, writeToolName?: string)
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
  getTrace(): ToolTrace
  getWrites(): readonly WriteCapture[]
  reset(): void
}

type MockToolImpl = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>
```

---

### `Matcher System` (Tier 0–4)

- **Ubicación:** `packages/core/src/matchers/`
- **Clasificación:** core domain
- **Responsabilidad:** Tiered assertion library for validating AI agent behavior. Tiers represent increasing cost/complexity: Tier 0 = deterministic trace checks, Tier 4 = LLM-as-judge evaluation.
- **Depende de:** `ToolTrace`, `ToolCall`, `WriteCapture`, `AgentDriver` (Tier 4 only)
- **Dependencias externas:** `openai` (Tier 3 embeddings), LLM provider (Tier 4 judge)
- **Consumido por:** `packages/vitest/src/matchers.ts`, `packages/promptfoo/src/assertions.ts`
- **Entradas:** `ToolTrace`, `string` (output), `WriteCapture[]`
- **Salidas:** `MatcherResult` with `pass`, `message`, `tier`, `diagnostic`
- **Estado interno:** stateless (except `EmbeddingCache` which is module-level)
- **Observaciones:** `[OBSERVED]` Tier 3 (`toBeSemanticallySimilar`) uses a module-level embedding cache to avoid redundant API calls. `[OBSERVED]` Tier 4 (`toPassJudge`) supports consensus voting (multiple LLM calls) for higher confidence via the `consensus` field in `JudgeResult` — not the default. `[OBSERVED]` The `tier` field on `MatcherResult` is diagnostic only — it is not used to affect pass/fail logic.

#### Firmas relevantes

```typescript
// Tier 0 — deterministic, zero cost
function toHaveCalledTool(trace: ToolTrace, name: string, args?: Record<string, unknown>): MatcherResult
function toNotHaveCalledTool(trace: ToolTrace, name: string): MatcherResult
function toHaveCalledToolsInOrder(trace: ToolTrace, names: string[]): MatcherResult
function toHaveCalledToolsInStrictOrder(trace: ToolTrace, names: string[]): MatcherResult
function toHaveToolCallCount(trace: ToolTrace, name: string, count: number): MatcherResult
function toHaveFirstCalledTool(trace: ToolTrace, name: string): MatcherResult
function toHaveLastCalledTool(trace: ToolTrace, name: string): MatcherResult

// Tier 1 — structural, zero cost
function toHaveMarkdownStructure(output: string, spec: MarkdownSpec): MatcherResult
function toMatchJsonSchema(output: string, schema: Record<string, unknown>): MatcherResult
function toHaveLineCount(output: string, spec: LineCountSpec): MatcherResult
function toHaveFileWritten(writesOrTrace: ReadonlyArray<WriteCapture> | ToolTrace, path: string, contentMatcher?: string | RegExp): MatcherResult

// Tier 2 — string content, zero cost
function toContain(output: string, pattern: string | RegExp): MatcherResult
function toNotContain(output: string, pattern: string | RegExp): MatcherResult
function toContainAll(output: string, patterns: (string | RegExp)[]): MatcherResult
function toContainAny(output: string, patterns: (string | RegExp)[]): MatcherResult
function toMention(output: string, term: string, options?: { stem?: boolean }): MatcherResult  // uses stemmer

// Tier 3 — embedding similarity, API cost
function toBeSemanticallySimilar(output: string, reference: string, options: SemanticSimilarityOptions): Promise<MatcherResult>
function toHaveSemanticOverlap(output: string, topics: string[], options: SemanticOverlapOptions): Promise<MatcherResult>

// Tier 4 — LLM judge, highest cost
function toPassJudge(output: string, criteria: string, options?: ToPassJudgeOptions): Promise<MatcherResult>
function toMatchTrajectory(trace: ToolTrace, config: TrajectoryConfig): Promise<MatcherResult>

interface ToPassJudgeOptions extends Omit<JudgeConfig, 'criteria'> {
  driver?: AgentDriver;
}

interface JudgeConfig {
  criteria: string;
  calibration?: string | CalibrationSet;
  model?: string;
  provider?: string;
  consensus?: number;
  temperature?: number;
  maxTokens?: number;
}

// RAG matchers — Tier 0 (deterministic, packages/core/src/matchers/rag/index.ts)
function toHaveRetrievedDocument(trace: ToolTrace, toolName: string, docMatcher: Record<string, unknown>): MatcherResult
function toHaveRetrievedTopResult(trace: ToolTrace, toolName: string, docMatcher: Record<string, unknown>): MatcherResult
function toNotHaveRetrievedDocument(trace: ToolTrace, toolName: string, docMatcher: Record<string, unknown>): MatcherResult
function toHaveRetrievedNResults(trace: ToolTrace, toolName: string, n: number): MatcherResult
function toHaveCitedSources(output: string, sources: string[]): MatcherResult

// RAG matchers — Tier 3 (embedding-based, packages/core/src/matchers/rag/semantic.ts)
async function toHaveGroundedResponseIn(trace: ToolTrace, output: string, toolName: string, options: GroundingOptions): Promise<MatcherResult>
async function toNotHaveHallucinated(trace: ToolTrace, output: string, toolName: string, options: HallucinationOptions): Promise<MatcherResult>
async function toHaveRetrievalScore(trace: ToolTrace, toolName: string, options: RetrievalScoreOptions): Promise<MatcherResult>

// MCP matchers (packages/core/src/matchers/mcp/index.ts)
function toHaveCalledMcpTool(trace: ToolTrace, serverName: string, toolName: string, expectedArgs?: Record<string, unknown>): MatcherResult
function toHaveCalledMcpServer(trace: ToolTrace, serverName: string): MatcherResult
function toNotHaveCalledMcpTool(trace: ToolTrace, serverName: string, toolName: string): MatcherResult
function toHaveCalledMcpToolsInOrder(trace: ToolTrace, calls: McpCallSpec[]): MatcherResult
```

---

### `CassetteRecorder` / `CassettePlayer`

- **Ubicación:** `packages/core/src/cassette/`
- **Clasificación:** infrastructure
- **Responsabilidad:** Serialize `RunResult` to JSON on disk (record), then replay deterministically without hitting any API (replay). Also supports partial overrides via `stubs`.
- **Depende de:** `RunResult`, `ToolTrace`, `CassetteStub`
- **Dependencias externas:** filesystem (`node:fs`)
- **Consumido por:** `runSkill()` (vitest), CLI `replay` command, MCP `tracepact_replay` tool
- **Entradas (recorder):** `RunResult` + `CassetteMetadata`
- **Salidas (player):** `RunResult` reconstructed from disk
- **Estado interno:** stateless after construction (path is fixed at construction time)
- **Observaciones:** `[OBSERVED]` Cassettes are versioned (`version: number`, initial value `1`). `[OBSERVED]` `CassettePlayer.load()` uses a `switch` on `version` — adding a new version requires only a new `case` branch; unknown versions still throw. `[OBSERVED]` Stubs allow overriding specific tool call results. Matching criteria: `toolName` (required), `sequenceIndex` (optional — omit to match any position), `args` (optional partial match on call arguments). `[OBSERVED]` `CassetteRecorder.save()` applies `RedactionPipeline` before writing to disk — cassette files are redacted according to `RedactionConfig`. `[OBSERVED]` The `RunManifest` fields (`promptHash`, `toolDefsHash`, `temperature`, `driverVersion`) are persisted in `CassetteMetadata` and fully restored by `CassettePlayer.replay()`.

#### Firmas relevantes

```typescript
class CassetteRecorder {
  constructor(filePath: string, redactionConfig?: RedactionConfig)
  async save(result: RunResult, metadata: CassetteMetadata): Promise<void>
}

class CassettePlayer {
  constructor(filePath: string, stubs?: CassetteStub[])
  async load(): Promise<Cassette>
  async replay(currentPrompt?: string): Promise<RunResult>
}

interface CassetteStub {
  at: { toolName: string; sequenceIndex?: number; args?: Readonly<Record<string, unknown>> }
  return: { type: 'success'; content: string } | { type: 'error'; message: string }
}
```

---

### `CacheStore`

- **Ubicación:** `packages/core/src/cache/`
- **Clasificación:** infrastructure
- **Responsabilidad:** Content-addressed, filesystem-based cache for `RunResult`. The cache key is a SHA256 hash of `RunManifest` — a deterministic fingerprint of all inputs that could affect output.
- **Depende de:** `CacheConfig`, `RunManifest`
- **Dependencias externas:** filesystem (`node:fs`), `node:crypto`
- **Consumido por:** `runSkill()` (vitest), `executePrompt()` (core)
- **Entradas:** `RunManifest`
- **Salidas:** `CacheEntry | null`
- **Estado interno:** stateless — reads/writes filesystem
- **Observaciones:** `[OBSERVED]` Cache entries have a configurable `ttlSeconds` (default 7 days) and optional `verifyOnRead` checksum validation. `[INFERRED]` Two runs with identical skill hash, prompt hash, tool defs hash, provider, model, temperature, and seed will always hit cache — temperature=0 + seed is required for reliable cache hits.

#### Firmas relevantes

```typescript
class CacheStore {
  constructor(config: CacheConfig)
  async get(manifest: RunManifest): Promise<CacheEntry | null>
  async set(manifest: RunManifest, result: unknown): Promise<void>
  async list(): Promise<CacheSummary[]>
  async clear(options?: { staleOnly: boolean }): Promise<number>
  async verify(): Promise<{ total: number; valid: number; corrupted: number; expired: number }>
}

interface RunManifest {
  readonly skillHash: string;       // SHA256 of skill file content
  readonly promptHash: string;      // SHA256 of prompt text
  readonly toolDefsHash: string;    // SHA256 of serialized tool defs
  readonly provider: string;
  readonly model: string;
  readonly modelVersion?: string;
  readonly temperature: number;
  readonly seed?: number;
  readonly frameworkVersion: string;
  readonly driverVersion: string;
}
```
