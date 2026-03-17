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
- **Consumido por:** `executePrompt()` (`driver/execute.ts`), `runSkill()` (`packages/vitest`), `TracepactProvider` (`packages/promptfoo`), CLI `capture` command, `JudgeExecutor` (`matchers/tier4/judge.ts`)
- **Entradas:** tool name + args from driver
- **Salidas:** `ToolResult` (success string or error), populates `ToolTrace`
- **Estado interno:** stateful — accumulates `ToolTrace` and `WriteCapture[]` during run
- **Observaciones:** `[OBSERVED]` The sandbox is reset between runs via `reset()`. `[OBSERVED]` `passthrough()` is a factory function exported from `sandbox/factories.js` (not a method on `MockSandbox`) — returns `{ type: 'success', content: '' }`, a no-op that silently succeeds. `[OBSERVED]` The tool name tracked for `WriteCapture` defaults to `'write_file'` but is configurable via the third constructor parameter. `[OBSERVED]` When `strict: true` is passed in `MockSandboxOptions`, args are validated against the JSON Schema declared in `MockToolEntry` before calling the impl — tools registered as plain functions (no schema) are unaffected. `[OBSERVED]` `validateArgs` in strict mode supports extended JSON Schema keywords: nested objects, `enum`, `minLength`, `maxLength`, `pattern`, and array `items` — not just top-level type checking. `[OBSERVED]` Unknown tool calls result in `{ type: 'error', message: "Unknown tool: '<name>'." }` and are still recorded in the trace with `unknownTool: true`. `[OBSERVED]` A `Sandbox` interface is exported from `sandbox/types.ts` that all sandbox implementations share (`executeTool`, `getTrace`, `getWrites`).

#### Firmas relevantes

```typescript
export interface MockSandboxOptions {
  strict?: boolean; // default: false — enable JSON Schema validation of args
}

export interface MockToolEntry {
  schema: Record<string, unknown>;
  impl: MockToolImpl;
}

export type MockToolDefs = Record<string, MockToolImpl | MockToolEntry>;

class MockSandbox {
  constructor(tools: MockToolDefs, sources?: Record<string, ToolCallSource>, writeToolName?: string, options?: MockSandboxOptions)
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
  getTrace(): ToolTrace
  getWrites(): readonly WriteCapture[]
  reset(): void
}

type MockToolImpl = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>

/** Shared interface implemented by all sandbox types. */
export interface Sandbox {
  executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  getTrace(): ToolTrace;
  getWrites(): ReadonlyArray<WriteCapture>;
}
```

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md)

<!-- SOURCES: packages/core/src/sandbox/mock-sandbox.ts, packages/core/src/sandbox/types.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/sandbox/mock-sandbox.ts`

```ts
export interface MockSandboxOptions {
  /**
   * When true, args are validated against the JSON schema declared in
   * MockToolEntry definitions before the impl is called. Tools registered
   * as plain functions (no schema) are not affected.
   * Defaults to false for backward compatibility.
   */
  strict?: boolean;
}

export class MockSandbox implements Sandbox {
  constructor(tools: MockToolDefs, sources: Record<string, ToolCallSource>, writeToolName: string, options: MockSandboxOptions)
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
  getTrace(): ToolTrace
  getWrites(): readonly WriteCapture[]
  reset(): void
}
```

### `packages/core/src/sandbox/types.ts`

```ts
export interface Sandbox {
  executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  getTrace(): ToolTrace;
  getWrites(): ReadonlyArray<WriteCapture>;
}

export interface MockToolEntry {
  schema: Record<string, unknown>;
  impl: MockToolImpl;
}

export interface WriteCapture {
  path: string;
  content: string;
}

export interface MockBashResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

export type MockToolImpl = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;

export type MockToolDefs = Record<string, MockToolImpl | MockToolEntry>;
```
<!-- END:GENERATED -->

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
- **Estado interno:** stateless (except `EmbeddingCache` which is a module-level singleton `globalEmbeddingCache`)
- **Observaciones:** `[OBSERVED]` Tier 3 matchers call `embedWithCache(provider, texts)` which deduplicates against a module-level `globalEmbeddingCache` (an instance of `EmbeddingCache`) — only uncached texts are sent to the provider. `[OBSERVED]` `EmbeddingCache` uses a 16-hex-character SHA256 prefix as the in-memory key. `[OBSERVED]` `EmbeddingCache` maintains an `inFlight: Map<string, Promise<number[]>>` to deduplicate concurrent embedding requests for the same text — a second call for an in-flight text awaits the first rather than firing a new API request. `[OBSERVED]` `clearEmbeddingCache()` is exported from `matchers/tier3/embedding-cache.ts` and re-exported via `matchers/tier3/index.ts` — call it between test suites to reset the cache. `[OBSERVED]` `OpenAIEmbeddingProvider` constructor accepts optional `model` and `dimensions` parameters, allowing callers to select specific embedding models without subclassing. `[OBSERVED]` Tier 4 (`toPassJudge`) requires `driver` in options — returns a fail result immediately if no driver is provided, without throwing. `[OBSERVED]` Tier 4 consensus voting: when `consensus > 1`, temperature defaults to `0.3`; single-judge mode defaults to `0`. Majority rule (`passed > consensusCount / 2`) determines pass/fail. `[OBSERVED]` `JudgeConfig.timeout?: number` is forwarded to `driver.run()` — limits per-judge-call latency. `[OBSERVED]` Partial voter failure: individual voter errors are collected in `voterErrors[]`; only when all voters fail does `JudgeExecutor.evaluate()` throw. `[OBSERVED]` Judge response parse failure now throws instead of silently returning `pass: false` — surfaces prompt/schema mismatches rather than producing misleading results. `[OBSERVED]` The `tier` field on `MatcherResult` is diagnostic only — it is not used to affect pass/fail logic. `[OBSERVED]` `JudgeExecutor` uses a `MockSandbox({})` internally for each judge API call — the judge LLM does not use any tools. `[OBSERVED]` When `consensus > 1`, all voter calls are dispatched concurrently via `Promise.allSettled` — latency is ~1× the individual judge latency, not N×. `[OBSERVED]` `singleJudge()` applies `RedactionPipeline` to the raw driver output before JSON parsing and before including it in error messages — judge responses are scrubbed of secrets the same way agent outputs are.

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
function toHaveFileWritten(writesOrTrace: ReadonlyArray<WriteCapture> | ToolTrace, path: string, contentMatcher?: string | RegExp, writeToolName?: string): MatcherResult

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
  timeout?: number;
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

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md)

<!-- SOURCES: packages/core/src/matchers/tier3/index.ts, packages/core/src/matchers/tier4/index.ts, packages/core/src/matchers/tier4/judge.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/matchers/tier3/index.ts`

```ts
export interface SemanticSimilarityOptions {
  threshold?: number; // default: 0.80
  provider: EmbeddingProvider;
}

export interface SemanticOverlapOptions {
  threshold?: number; // per-topic similarity threshold, default: 0.75
  minTopics?: number; // minimum topics that must match, default: all
  provider: EmbeddingProvider;
}

export async function toBeSemanticallySimilar(output: string, reference: string, options: SemanticSimilarityOptions): Promise<MatcherResult>

export async function toHaveSemanticOverlap(output: string, topics: string[], options: SemanticOverlapOptions): Promise<MatcherResult>
```

### `packages/core/src/matchers/tier4/index.ts`

```ts
export interface ToPassJudgeOptions extends Omit<JudgeConfig, 'criteria'> {
  driver?: AgentDriver;
}

export async function toPassJudge(output: string, criteria: string, options: ToPassJudgeOptions): Promise<MatcherResult>
```

### `packages/core/src/matchers/tier4/judge.ts`

```ts
export interface JudgeConfig {
  criteria: string;
  calibration?: string | CalibrationSet;
  model?: string;
  provider?: string;
  consensus?: number;
  temperature?: number;
  maxTokens?: number;
  /** Timeout in milliseconds for a single judge LLM call. */
  timeout?: number;
}

export interface JudgeVote {
  pass: boolean;
  confidence: number;
  justification: string;
  reasoning: string;
  tokens: number;
}

export interface JudgeResult {
  pass: boolean;
  confidence: number;
  justification: string;
  reasoning: string;
  tokens: number;
  votes: JudgeVote[];
  consensus: { passed: number; failed: number; total: number };
  /** Errors from individual voters that failed, if any. Only present when at least one voter errored. */
  voterErrors?: string[];
}

export function buildJudgePrompt(output: string, criteria: string, calibration: CalibrationSet): string

export class JudgeExecutor {
  constructor(driver: AgentDriver)
  async evaluate(output: string, config: JudgeConfig): Promise<JudgeResult>
}
```
<!-- END:GENERATED -->

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
- **Observaciones:** `[OBSERVED]` Cassettes are versioned — `CURRENT_VERSION = 1` is the current version constant. `[OBSERVED]` `CassettePlayer` uses a `MIGRATORS` table and `migrate()` function for version upgrades — each entry maps a version number to a migration function; cassettes are automatically migrated forward on load. Unknown versions still throw. `[OBSERVED]` Stubs allow overriding specific tool call results. Matching criteria: `toolName` (required), `sequenceIndex` (optional — omit to match any position), `args` (optional — uses `JSON.stringify` deep equality instead of `===` for object args). `[OBSERVED]` Unmatched stubs emit a `log.warn` rather than silently being ignored. `[OBSERVED]` `CassetteRecorder.save()` applies `RedactionPipeline` before writing to disk — cassette files are redacted according to `RedactionConfig`. `[OBSERVED]` `CassetteRecorder` accepts `maxEntrySizeBytes?: number` — entries exceeding the limit are rejected. `[OBSERVED]` The `RunManifest` fields (`promptHash`, `toolDefsHash`, `temperature`, `driverVersion`) are persisted in `CassetteMetadata` and fully restored by `CassettePlayer.replay()`. `[OBSERVED]` `CassettePlayer` constructor accepts a third `strict` parameter (default `true`) — when `true`, a prompt mismatch between the recorded cassette and the current prompt throws an error; when `false`, it logs a warning and continues. `[OBSERVED]` `CassettePlayer.replay()` accepts `currentToolDefsHash?` and validates it against the recorded hash — mismatches are reported with a SHA-256 prefix and the first diff index. `[OBSERVED]` `CassettePlayer.replay()` returns `cacheStatus: 'cassette_replay'` on the replay path. `[OBSERVED]` `CassettePlayer.replay()` reconstructs `RunManifest` from cassette metadata fields; `modelVersion` and `seed` are not included in the reconstructed manifest.

#### Firmas relevantes

```typescript
class CassetteRecorder {
  constructor(filePath: string, redactionConfig?: RedactionConfig)
  async save(result: RunResult, metadata: CassetteMetadata): Promise<void>
}

class CassettePlayer {
  constructor(filePath: string, stubs?: CassetteStub[], strict?: boolean)  // strict defaults to true
  async load(): Promise<Cassette>
  async replay(currentPrompt?: string, currentToolDefsHash?: string): Promise<RunResult>
}

interface CassetteStub {
  at: { toolName: string; sequenceIndex?: number; args?: Readonly<Record<string, unknown>> }
  return: { type: 'success'; content: string } | { type: 'error'; message: string }
}
```

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md)

<!-- SOURCES: packages/core/src/cassette/player.ts, packages/core/src/cassette/recorder.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/cassette/player.ts`

```ts
export class CassettePlayer {
  constructor(filePath: string, stubs: CassetteStub[], strict: boolean)
  async load(): Promise<Cassette>
  async reload(): Promise<Cassette>
  async replay(currentPrompt: string, currentToolDefsHash: string): Promise<RunResult>
}
```

### `packages/core/src/cassette/recorder.ts`

```ts
export class CassetteRecorder {
  constructor(filePath: string, redactionConfig: RedactionConfig, maxEntrySizeBytes: number)
  async save(result: RunResult, metadata: CassetteMetadata): Promise<void>
}
```
<!-- END:GENERATED -->

---

### `CacheStore`

- **Ubicación:** `packages/core/src/cache/`
- **Clasificación:** infrastructure
- **Responsabilidad:** Content-addressed, filesystem-based cache for `RunResult`. The cache key is a SHA256 hash of `RunManifest` — a deterministic fingerprint of all inputs that could affect output.
- **Depende de:** `CacheConfig`, `RunManifest`, `RedactionPipeline`
- **Dependencias externas:** filesystem (`node:fs`), `node:crypto`
- **Consumido por:** `runSkill()` (vitest), `executePrompt()` (core)
- **Entradas:** `RunManifest`
- **Salidas:** `CacheEntry | null`
- **Estado interno:** stateless — reads/writes filesystem; tracks `_writeFailures` count
- **Observaciones:** `[OBSERVED]` Cache entries have a configurable `ttlSeconds` (default 7 days) and optional `verifyOnRead` checksum validation. `[INFERRED]` Two runs with identical skill hash, prompt hash, tool defs hash, provider, model, temperature, and seed will always hit cache — temperature=0 + seed is required for reliable cache hits. `[OBSERVED]` `CacheStore` accepts an optional `redactionConfig` in its constructor and applies `RedactionPipeline` to results before writing — cache files are redacted. `[OBSERVED]` `CacheConfig.maxEntrySizeBytes?: number` — entries exceeding this limit are skipped (not written) to prevent unbounded disk growth; a `log.warn` is emitted when an entry is skipped. `[OBSERVED]` `set()` uses an atomic write: data is first written to a `.tmp` file, then renamed to the final path — prevents partial writes from being read. `[OBSERVED]` `clear()` removes leftover `.tmp` files and emits `log.warn` if a tmp file cleanup fails (previously silent). `[OBSERVED]` Write failures increment `_writeFailures` and are non-fatal (logged as warnings, execution continues).

#### Firmas relevantes

```typescript
class CacheStore {
  constructor(config: CacheConfig, redactionConfig?: RedactionConfig)
  get writeFailures(): number
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

> **Lee también:** [wiring.md — cómo se integra con executePrompt](./wiring.md)

<!-- SOURCES: packages/core/src/cache/cache-store.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/cache/cache-store.ts`

```ts
export interface CacheEntry {
  manifest: RunManifest;
  result: unknown;
  checksum: string;
  createdAt: string;
  ttl?: number;
}

export interface CacheSummary {
  hash: string;
  skillHash: string;
  provider: string;
  model: string;
  createdAt: string;
  status: 'valid' | 'expired' | 'corrupted';
}

export class CacheStore {
  constructor(config: CacheConfig, redactionConfig: RedactionConfig)
  async get(manifest: RunManifest): Promise<CacheEntry>
  async set(manifest: RunManifest, result: unknown): Promise<void>
  async list(): Promise<CacheSummary[]>
  async clear(options: { staleOnly: boolean; }): Promise<number>
  async verify(): Promise<{ total: number; valid: number; corrupted: number; expired: number; }>
}
```
<!-- END:GENERATED -->
