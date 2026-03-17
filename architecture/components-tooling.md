> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Componentes de herramientas y adapters de integración — AuditEngine, McpClient, Vitest plugin, RedactionPipeline
> **Índice general:** [index.md](./index.md)

# Architectural Components — Tooling & Integrations

Otros grupos de componentes: [components-drivers.md](./components-drivers.md) · [components-testing.md](./components-testing.md)

---

### `AuditEngine`

- **Ubicación:** `packages/core/src/audit/`
- **Clasificación:** core domain
- **Responsabilidad:** Static analysis of skill definitions. Runs a set of rules against skill frontmatter + body and produces findings with severity levels.
- **Depende de:** `AuditRule[]`, `AuditInput`
- **Dependencias externas:** none
- **Consumido por:** CLI `audit` command, MCP `tracepact_audit` tool
- **Entradas:** `AuditInput` (name, description, body, tools, triggers, excludes)
- **Salidas:** `AuditReport` (findings, pass, summary by severity)
- **Estado interno:** stateless
- **Observaciones:** `[OBSERVED]` Four builtin rules: `toolComboRisk`, `promptHygiene`, `skillCompleteness`, `noOpaqueTools`. `[OBSERVED]` Constructor is optional (`rules?`) — defaults to `BUILTIN_RULES` when called without args (as CLI does). `[OBSERVED]` `AuditEngine` is immutable post-construction — there is no `addRule()` method; rules must be passed at construction time. `[OBSERVED]` Each `rule.check()` call is wrapped in try-catch — a rule that throws produces a `'medium'`-severity `AuditFinding` instead of propagating the exception. `[OBSERVED]` `AuditReport.pass` is `true` only when both `critical` and `high` finding counts are zero; `medium` and `low` findings do not fail the audit.

#### Firmas relevantes

```typescript
class AuditEngine {
  constructor(rules?: AuditRule[])  // defaults to BUILTIN_RULES if omitted
  auditSkill(skill: ParsedSkill): AuditReport  // main entry used by CLI and MCP; builds AuditInput from skill
  audit(input: AuditInput): AuditReport        // lower-level, called by auditSkill()
}

interface AuditRule {
  readonly name: string;
  readonly description: string;
  readonly check: (input: AuditInput) => AuditFinding[];
}
```

> **Lee también:** [flows.md — flujo del comando tracepact audit](./flows.md)

<!-- SOURCES: packages/core/src/audit/engine.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/audit/engine.ts`

```ts
export class AuditEngine {
  constructor(rules: AuditRule[])
  auditSkill(skill: ParsedSkill): AuditReport
  audit(input: AuditInput): AuditReport
}
```
<!-- END:GENERATED -->

---

### `McpClient`

- **Ubicación:** `packages/core/src/mcp/`
- **Clasificación:** infrastructure / adapter
- **Responsabilidad:** Spawns an MCP server subprocess and exposes its tools as `McpToolInfo[]`. The factory function `connectMcp()` (in `connect.ts`) converts them to `TypedToolDefinition[]` consumable by drivers. Bridges MCP tool calls back to the server process.
- **Depende de:** `@modelcontextprotocol/sdk`, `McpToolInfo`, `ToolResult`
- **Dependencias externas:** `@modelcontextprotocol/sdk`
- **Consumido por:** `connectMcp()` → `runSkill()` (vitest)
- **Entradas:** `McpClientConfig` (server, command, args, env)
- **Salidas:** `McpConnection` (tools array, handlers map, sources map, close fn)
- **Estado interno:** stateful — subprocess lifecycle + active connection
- **Observaciones:** `[OBSERVED]` `connectMcp()` returns a `McpConnection` object that includes `handlers` and `sources` for injection into `MockSandbox`, completing the integration loop between MCP and the test sandbox. `[OBSERVED]` `McpConnection` is defined in `connect.ts`, not `client.ts` — `McpClient` is a lower-level class used only by `connectMcp()`. `[OBSERVED]` `McpClientConfig` accepts `toolCallTimeoutMs?: number` (default 30s) — `callTool()` is wrapped with `Promise.race()` so hung tool calls are aborted after the timeout rather than hanging indefinitely. `[OBSERVED]` `_connected = false` is only set on `McpError(ConnectionClosed)` errors, not on all errors — transient tool errors do not mark the connection as closed. `[OBSERVED]` `close()` is a no-op if not connected.

#### Firmas relevantes

```typescript
class McpClient {
  readonly server: string;
  readonly source: ToolCallSource;
  constructor(config: McpClientConfig)
  async connect(): Promise<void>
  get tools(): readonly McpToolInfo[]
  get connected(): boolean
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
  async close(): Promise<void>
}

async function connectMcp(config: McpClientConfig): Promise<McpConnection>

interface McpConnection {
  server: string;
  tools: TypedToolDefinition[];
  handlers: Record<string, MockToolImpl>;
  sources: Record<string, ToolCallSource>;
  close: () => Promise<void>;
}
```

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md)

<!-- SOURCES: packages/core/src/mcp/client.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/mcp/client.ts`

```ts
export interface McpClientConfig {
  /** Display name for this server (used in trace source tags) */
  server: string;
  /** Command to spawn the MCP server process */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables for the server process */
  env?: Record<string, string>;
  /** Timeout in ms for each tool call. Defaults to 30 000 ms. */
  toolCallTimeoutMs?: number;
}

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export class McpClient {
  constructor(config: McpClientConfig)
  async connect(): Promise<void>
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>
  async close(): Promise<void>
}
```
<!-- END:GENERATED -->

---

### `tracepactPlugin` (Vitest Plugin)

- **Ubicación:** `packages/vitest/src/plugin.ts`
- **Clasificación:** adapter / integration
- **Responsabilidad:** Vitest plugin that reads env flags and configures the global test run; sets file include patterns, installs custom matchers via `setupFiles`, and sets `testTimeout`.
- **Depende de:** `@tracepact/core`
- **Dependencias externas:** `vitest`
- **Consumido por:** user's `vitest.config.ts` via `plugins: [tracepactPlugin()]`
- **Entradas:** Vitest lifecycle hooks + env vars
- **Salidas:** modified Vitest behavior (test filtering, reporter injection, global setup)
- **Estado interno:** stateless (configuration is read once at plugin init)
- **Observaciones:** `[OBSERVED]` The plugin only configures three Vitest settings: `include` pattern (`['**/*.tracepact.ts', '**/*.tracepact.js']`), `setupFiles` (points to compiled `setup.js`), and `testTimeout`. The timeout reads `TRACEPACT_TEST_TIMEOUT` env var (ms), falling back to `30000`. It does NOT implement test filtering. `[OBSERVED]` `cheap()` / `expensive()` / `live()` test wrappers are defined in `test-live.ts` and `annotations.ts` and work independently of this plugin — they use `vitest.test.skipIf()` directly.

<!-- SOURCES: packages/vitest/src/plugin.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/vitest/src/plugin.ts`

```ts
export function tracepactPlugin(): Plugin<any>
```
<!-- END:GENERATED -->

---

### `setup.ts` (Vitest Setup File)

- **Ubicación:** `packages/vitest/src/setup.ts`
- **Clasificación:** adapter / integration
- **Responsabilidad:** Vitest setup file installed by `tracepactPlugin`. Extends `expect` with `tracepactMatchers`, manages embedding and registry cache lifecycle, and runs a provider health check before the suite in live mode.
- **Depende de:** `@tracepact/core` (`DriverRegistry`, `detectProvider`, `defineConfig`, `clearEmbeddingCache`, `clearRegistryCache`, `resetCache`, `PROVIDER_ENV_KEYS`), `./matchers.js`
- **Dependencias externas:** `vitest`
- **Consumido por:** Vitest automatically, via `setupFiles` in `tracepactPlugin`
- **Estado interno:** module-level side effects (cache clearing, health check)
- **Observaciones:** `[OBSERVED]` `initLogLevelFromEnv()` is called at module level so log level is applied before any test runs. `[OBSERVED]` `clearEmbeddingCache()` is called in `beforeEach` to prevent embedding state from bleeding between tests. `[OBSERVED]` `afterEach` calls `_closePendingMcpConnections()` to clean up any MCP connections opened during the test. `[OBSERVED]` `afterAll` clears embedding cache, registry cache, and resets the response cache via `resetCache()`. `[OBSERVED]` The health check runs only when `TRACEPACT_LIVE === '1'`; it uses `resolveConfig()` (not a hardcoded model list) to build the config, calls `validateAll()`, then `driver.healthCheck()`. `[OBSERVED]` If `TRACEPACT_HEALTH_CHECK_STRICT === '1'` and the health check fails, the process exits with code `4`.

<!-- SOURCES: packages/vitest/src/setup.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

_No exported symbols found._
<!-- END:GENERATED -->

---

### `runSkill`

- **Ubicación:** `packages/vitest/src/run-skill.ts`
- **Clasificación:** adapter / integration
- **Responsabilidad:** Primary test-facing entry point for executing a skill in a test. Orchestrates live execution, cassette replay, and explicit mock-only mode. Integrates MCP connections into the sandbox automatically and tracks token usage.
- **Depende de:** `@tracepact/core` (`executePrompt`, `MockSandbox`, `TokenAccumulator`), `./token-tracker.js`
- **Dependencias externas:** none
- **Consumido por:** user test files (`.tracepact.ts`)
- **Entradas:** `ParsedSkill | string | { systemPrompt: string }`, `RunSkillOptions`
- **Salidas:** `RunResult`
- **Estado interno:** stateless (per-call `TokenAccumulator` is created fresh each invocation)
- **Observaciones:** `[OBSERVED]` Three execution modes — live (`TRACEPACT_LIVE=1`), replay (cassette path via `replay` option or `TRACEPACT_REPLAY` env), and mock (`mode: 'mock'`). If none is configured, `runSkill()` throws an error with actionable instructions. `[OBSERVED]` `mcp?: McpConnection[]` option: when provided and no explicit `sandbox` is given, `buildMcpSandbox()` merges all connections into a single `MockSandbox`, merging `handlers`, `sources`, and `tools` from all connections. `[OBSERVED]` MCP connections opened during `runSkill()` are registered in `_pendingMcpConnections` — exported `_closePendingMcpConnections()` allows `setup.ts` (via `afterEach`) to close them automatically. `[OBSERVED]` Cassette recording is triggered by `record` option (explicit path) or `TRACEPACT_RECORD=1` env var; when using the env var, a deterministic path is generated via `generateCassettePath()` — a `./cassettes/<slug>-<sha256[:8]>.json` path whose hash now incorporates sorted tool names in addition to the prompt. `[OBSERVED]` In mock mode (`mode: 'mock'`), `runSkill()` returns a synthetic `RunResult` with `cacheStatus: 'skipped'` and real SHA-256 hashes for `skillHash`, `promptHash`, and `toolDefsHash` in the run manifest. `[OBSERVED]` `TRACEPACT_CASSETTE_DIR` overrides the default `cassettes` directory for auto-generated paths. `[OBSERVED]` Token usage is only tracked in live mode (`TRACEPACT_LIVE=1`) when `inputTokens > 0`.

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md) · [wiring.md — cómo se inyecta](./wiring.md)

<!-- SOURCES: packages/vitest/src/run-skill.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/vitest/src/run-skill.ts`

```ts
// simplified
export interface RunSkillOptions {
  prompt: string;;
  sandbox?: MockSandbox;;
  tools?: TypedToolDefinition[];;
  mcp?: McpConnection[];;
  config?: RunConfig;;
  tracepactConfig?: Partial<TracepactConfig>;;
  record?: string;;
  replay?: string;;
  stubs?: CassetteStub[];;
  mode?: 'mock';;
}

export async function _closePendingMcpConnections(): Promise<void>

export async function runSkill(skill: any, input: RunSkillOptions): Promise<RunResult>
```
<!-- END:GENERATED -->

---

### `tracepactMatchers`

- **Ubicación:** `packages/vitest/src/matchers.ts`
- **Clasificación:** adapter / integration
- **Responsabilidad:** Adapts all `@tracepact/core` matcher functions to the Vitest `expect` API. Handles sync/async/guarded variants, formats diagnostic output, and tracks judge token usage.
- **Depende de:** `@tracepact/core` (all matcher functions), `./token-tracker.js`
- **Dependencias externas:** none (pure adaptation layer)
- **Consumido por:** `setup.ts` via `expect.extend(tracepactMatchers)`
- **Estado interno:** stateless
- **Observaciones:** `[OBSERVED]` Four adapter patterns: `adaptSync` (sync, no ToolTrace guard), `adaptSyncGuarded` (sync, ToolTrace type guard), `adaptAsyncFn` (async, no judge tokens), `adaptAsyncJudge` (async, tracks judge token usage). `[OBSERVED]` Guarded adapters call `assertToolTrace()` before delegating to the core matcher — throws a `TypeError` with a descriptive message if the received value is not a `ToolTrace`. `[OBSERVED]` Judge token usage is only tracked when `TRACEPACT_LIVE === '1'`. `[OBSERVED]` `formatDiagnostic()` includes up to 5 trace calls in the failure message when `relevantTrace` is present. `[OBSERVED]` The exported `tracepactMatchers` object groups matchers by tier: Tier 0 (tool call assertions), Tier 1 (structure), Tier 2 (string content), Tier 3 (semantic), Tier 4 (judge), MCP, and RAG.

<!-- SOURCES: packages/vitest/src/matchers.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

_No exported symbols found._
<!-- END:GENERATED -->

---

### `RedactionPipeline`

- **Ubicación:** `packages/core/src/redaction/`
- **Clasificación:** cross-cutting / infrastructure
- **Responsabilidad:** Scrubs sensitive data (API keys, credit cards, env var values) from strings and objects before they are written to the cache.
- **Depende de:** `RedactionConfig`, `BUILTIN_RULES`
- **Dependencias externas:** none
- **Consumido por:** `CacheStore` before writing to disk, `CassetteRecorder` before writing cassettes `[OBSERVED]`
- **Estado interno:** stateless
- **Observaciones:** `[OBSERVED]` Applied in two places: `CacheStore.set()` before writing to disk (`cache-store.ts`), and `CassetteRecorder.save()` before writing cassettes to disk (`recorder.ts`). Both instantiate `RedactionPipeline` with the user-supplied `RedactionConfig` so custom rules and `redactEnvValues` are respected. `[OBSERVED]` Also applied to `RunResult` in `executePrompt()` before returning — the returned result is already redacted. `[OBSERVED]` Beyond explicit `redactEnvValues` config, the pipeline auto-detects secret env vars at construction time: any env var whose name matches the pattern `(_API_KEY|_TOKEN|_SECRET|_PASSWORD|_CREDENTIAL|_PRIVATE_KEY|_PASS)$` (case-insensitive) or starts with a well-known provider prefix (`ANTHROPIC_`, `OPENAI_`, `COHERE_`, `GEMINI_`) is automatically added as a redaction rule. `[OBSERVED]` `SAFE_ENV_NAMES` allowlist prevents common non-secret env vars (e.g. `PATH`, `NODE_ENV`) from being flagged even if their name matches a suffix pattern. `[OBSERVED]` `looksLikeSecretValue()` entropy-based heuristic filters out low-entropy env var values (e.g. `'true'`, `'1'`, short words) to reduce false positives. `[OBSERVED]` Auto-detected names that overlap with explicit `redactEnvValues` are deduplicated — explicit names are collected first and excluded from the auto-detection scan. `[OBSERVED]` `redactObject<T>()` uses a recursive `redactValue` visitor instead of a `JSON.stringify`/`JSON.parse` round-trip — handles non-JSON-safe values and avoids full serialization overhead.

> **Lee también:** [wiring.md — dónde se aplica como cross-cutting concern](./wiring.md)

<!-- SOURCES: packages/core/src/redaction/pipeline.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/redaction/pipeline.ts`

```ts
export class RedactionPipeline {
  constructor(config: RedactionConfig)
  redact(input: string): string
  redactObject(obj: T): T
}
```
<!-- END:GENERATED -->
