> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Componentes del subsistema de drivers — la capa que abstrae los AI providers (Anthropic, OpenAI) y controla la ejecución del agentic loop
> **Índice general:** [index.md](./index.md)

# Architectural Components — Drivers

Otros grupos de componentes: [components-testing.md](./components-testing.md) · [components-tooling.md](./components-tooling.md)

---

### `AgentDriver` (interface)

- **Ubicación:** `packages/core/src/driver/types.ts`
- **Clasificación:** core domain (interface / contract)
- **Responsabilidad:** Defines the contract for running a skill against any AI provider. All provider-specific logic lives behind this interface.
- **Depende de:** `RunInput`, `RunResult`, `ToolTrace`, `Sandbox`, `RunConfig`
- **Dependencias externas:** none (it's a contract)
- **Consumido por:** `DriverRegistry`, `runSkill()`, `executePrompt()`, `JudgeExecutor`
- **Entradas:** `RunInput` (skill, prompt, tools, sandbox, conversation, config)
- **Salidas:** `RunResult` (output, trace, messages, usage, duration, runManifest, cacheStatus?)
- **Estado interno:** stateless
- **Observaciones:** `[OBSERVED]` Clean interface. Capabilities struct (`DriverCapabilities`) lets callers query feature support (seed, streaming, parallelToolCalls, contentBlockConversation) without casting. `[OBSERVED]` `RunResult.cacheStatus` is now required — it is always set on every path: `'hit'` (cache), `'miss'` (live call, cache written), `'failed'` (live call, cache write failed), `'skipped'` (cache disabled / mock mode), or `'cassette_replay'` (cassette path). `[OBSERVED]` `RunConfig` includes an `onChunk` callback for streaming text chunks, `stream` flag to enable streaming mode, and `timeout?: number` for per-run timeout enforcement.

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md)

<!-- SOURCES: packages/core/src/driver/types.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/driver/types.ts`

```ts
export interface DriverCapabilities {
  seed: boolean;
  parallelToolCalls: boolean;
  streaming: boolean;
  systemPromptRole: boolean;
  maxContextWindow: number;
  /**
   * Whether the driver accepts `ContentBlock[]` as `Message.content` in
   * `RunInput.conversation`. When `false`, all conversation messages must use
   * plain `string` content (e.g. OpenAI). When `true`, the driver natively
   * handles `ContentBlock[]` (e.g. Anthropic).
   */
  contentBlockConversation: boolean;
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  modelVersion?: string;
  error?: string;
}

export interface AgentDriver {
  readonly name: string;
  readonly capabilities: DriverCapabilities;
  run(input: RunInput): Promise<RunResult>;
  healthCheck(): Promise<HealthCheckResult>;
}

export interface RunInput {
  skill: ParsedSkill | { systemPrompt: string };
  prompt: string;
  tools?: TypedToolDefinition[];
  sandbox: Sandbox;
  conversation?: Message[];
  config?: RunConfig;
}

export interface RunConfig {
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  timeout?: number;
  maxToolIterations?: number;
  /** Enable streaming for LLM responses (reduces time-to-first-token). */
  stream?: boolean;
  /** Called with each text chunk when streaming is enabled. */
  onChunk?: (chunk: string) => void;
}

export interface RunResult {
  output: string;
  trace: ToolTrace;
  messages: Message[];
  usage: UsageInfo;
  duration: number;
  runManifest: RunManifest;
  /**
   * Describes how the cache/replay layer handled this result:
   * - `'miss'`             — live LLM call; result was written to cache successfully.
   * - `'failed'`           — live LLM call; cache write failed (I/O error, etc.).
   * - `'skipped'`          — live LLM call; cache is disabled (TRACEPACT_NO_CACHE=1 or config).
   * - `'hit'`              — result came from the on-disk cache (no LLM call made).
   * - `'cassette_replay'`  — result came from a cassette file (no LLM call made).
   */
  cacheStatus: 'miss' | 'failed' | 'skipped' | 'hit' | 'cassette_replay';
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  model: string;
  modelVersion?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
```
<!-- END:GENERATED -->

---

### `AnthropicDriver`

- **Ubicación:** `packages/core/src/driver/anthropic-driver.ts`
- **Clasificación:** infrastructure / adapter
- **Responsabilidad:** Implements `AgentDriver` for the Anthropic API. Runs the agentic tool-use loop (text → tool calls → tool results → text) with optional streaming.
- **Depende de:** `RetryPolicy`, `Semaphore`, `computeManifest` (cache), `DEFAULT_MAX_TOOL_ITERATIONS`/`DEFAULT_TEMPERATURE` (config), `DriverError`
- **Dependencias externas:** `@anthropic-ai/sdk` (optional peer dependency, loaded with dynamic `import()`)
- **Consumido por:** `DriverRegistry` (registered as the sole entry in `NATIVE_DRIVERS`)
- **Entradas:** `RunInput`
- **Salidas:** `RunResult`
- **Estado interno:** lazily stateful — holds a cached `AnthropicClient` instance after first `getClient()` call
- **Observaciones:** `[OBSERVED]` Dynamic import of SDK means the package is optional — if missing at runtime, `getClient()` throws a `DriverError` with explicit install instructions (`npm install @anthropic-ai/sdk`), not a generic "Cannot find module". `[OBSERVED]` The 200k context window value is hardcoded in capabilities, not queried from the API. `[OBSERVED]` `run()` enforces capability contracts: requesting `stream: true` on a driver with `capabilities.streaming === false` throws immediately. `[OBSERVED]` Constructor throws `DriverError` immediately if `ANTHROPIC_API_KEY` is not available (env or config) — not deferred to first `run()` call. `[OBSERVED]` `_setClient()` method allows injecting a mock `AnthropicClient` for testing without touching the real SDK. `[OBSERVED]` System messages in `input.conversation` are silently skipped (Anthropic sends system prompt via a dedicated `system` field, not a message role). `[OBSERVED]` `run()` enforces `RunConfig.timeout` via `Promise.race()` with an `AbortController` signal — timed-out runs throw `DriverError`. `[OBSERVED]` Streaming `for await` loop is wrapped in try-catch; JSON parse failures in streaming are logged as `log.warn` rather than crashing. `[OBSERVED]` `healthCheck()` uses a 5s timeout. `[OBSERVED]` Per-iteration `log.debug` timing added for LLM calls and `executeTool` calls. `[OBSERVED]` Returns `cacheStatus: 'miss'` on the live-call path.

#### Firmas relevantes

```typescript
// capabilities (observed in source)
capabilities = {
  seed: false,
  parallelToolCalls: true,
  streaming: true,
  systemPromptRole: true,
  maxContextWindow: 200000,
}

// constructor
constructor(config: {
  model: string;
  apiKey?: string;
  providerName?: string;
  maxConcurrency?: number;
  retry?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number };
})

/** @internal — allows injecting a mock client for testing */
_setClient(mockClient: AnthropicClient): void
```

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md)

<!-- SOURCES: packages/core/src/driver/anthropic-driver.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/driver/anthropic-driver.ts`

```ts
export class AnthropicDriver implements AgentDriver {
  constructor(config: { model: string; apiKey?: string; providerName?: string; maxConcurrency?: number; retry?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; }; })
  async run(input: RunInput): Promise<RunResult>
  async healthCheck(): Promise<HealthCheckResult>
}
```
<!-- END:GENERATED -->

---

### `OpenAIDriver`

- **Ubicación:** `packages/core/src/driver/openai-driver.ts`
- **Clasificación:** infrastructure / adapter
- **Responsabilidad:** Implements `AgentDriver` for OpenAI (and compatible) APIs. Supports seed for deterministic runs. Acts as the fallback driver for all non-Anthropic providers via `baseURL` override.
- **Depende de:** `RetryPolicy`, `Semaphore`, `computeManifest` (cache), `DEFAULT_MAX_TOOL_ITERATIONS`/`DEFAULT_TEMPERATURE` (config), `DriverError`, `log` (logger)
- **Dependencias externas:** `openai` (loaded with dynamic `import()`, lazily initialized)
- **Consumido por:** `DriverRegistry` (fallback for all providers not in `NATIVE_DRIVERS`)
- **Entradas:** `RunInput`
- **Salidas:** `RunResult`
- **Estado interno:** lazily stateful — holds a cached `OpenAIClient` instance after first `getClient()` call
- **Observaciones:** `[OBSERVED]` Two private methods split the streaming path: `runStreaming()` handles stream assembly (text + tool call reconstruction by index), `executeToolCalls()` handles sandbox dispatch — both streaming and non-streaming paths share `executeToolCalls()`, keeping error handling consistent across modes. `[OBSERVED]` `baseURL` override enables routing to any OpenAI-compatible endpoint (Groq, Together, Mistral, xAI, Cerebras, Fireworks, Perplexity, DeepSeek, OpenRouter) — this is how all OpenAI-compatible provider presets work without separate driver implementations. `[OBSERVED]` `run()` enforces capability contracts: requesting `stream: true` on a driver with `capabilities.streaming === false` throws immediately. `[OBSERVED]` Constructor throws `DriverError` immediately if the API key is not available — error message includes the provider name when one is given, not just the generic `OPENAI_API_KEY` hint. `[OBSERVED]` `_setClient()` method allows injecting a mock `OpenAIClient` for testing. `[OBSERVED]` OpenAI driver rejects `ContentBlock[]` in conversation messages at runtime — only string content is supported for multi-turn resumption. `[OBSERVED]` Streaming uses `stream_options: { include_usage: true }` to capture token counts from the final chunk. `[OBSERVED]` `run()` enforces `RunConfig.timeout` via `Promise.race()` with an `AbortController` signal. `[OBSERVED]` Streaming `for await` loop is wrapped in try-catch; JSON parse failures logged as `log.warn`. `[OBSERVED]` `healthCheck()` uses a 5s timeout. `[OBSERVED]` Per-iteration `log.debug` timing added for LLM calls and `executeTool` calls. `[OBSERVED]` Returns `cacheStatus: 'miss'` on the live-call path.

#### Firmas relevantes

```typescript
capabilities = {
  seed: true,
  parallelToolCalls: true,
  streaming: true,
  systemPromptRole: true,
  maxContextWindow: 128000,
}

// constructor
constructor(config: {
  model: string;
  apiKey?: string;
  baseURL?: string;
  providerName?: string;
  maxConcurrency?: number;
  retry?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number };
})

/** @internal — allows injecting a mock client for testing */
_setClient(mockClient: OpenAIClient): void
```

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md)

<!-- SOURCES: packages/core/src/driver/openai-driver.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/driver/openai-driver.ts`

```ts
export class OpenAIDriver implements AgentDriver {
  constructor(config: { model: string; apiKey?: string; baseURL?: string; providerName?: string; maxConcurrency?: number; retry?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; }; })
  async run(input: RunInput): Promise<RunResult>
  async healthCheck(): Promise<HealthCheckResult>
}
```
<!-- END:GENERATED -->

---

### `DriverRegistry`

- **Ubicación:** `packages/core/src/driver/registry.ts`
- **Clasificación:** orchestration
- **Responsabilidad:** Builds and holds all configured `AgentDriver` instances. Acts as service locator for drivers. Supports extension via static `register()` for custom driver classes.
- **Depende de:** `TracepactConfig`, `AnthropicDriver`, `OpenAIDriver`, `PROVIDER_PRESETS`, `PROVIDER_ENV_KEYS`, `ConfigError`, `log`
- **Dependencias externas:** none
- **Consumido por:** `executePrompt()` (core) — es el único lugar donde se instancia en producción. `runSkill()` lo usa indirectamente a través de `executePrompt()`. `healthCheckAll()` solo se usa en tests.
- **Entradas:** `TracepactConfig`
- **Salidas:** `AgentDriver` instances
- **Estado interno:** stateful — holds a `Map<string, AgentDriver>` and a `Map<string, Error>` for deferred init errors
- **Observaciones:** `[OBSERVED]` `getDefault()` returns the driver for the `providers.default` key in config. `[OBSERVED]` Initialization errors are deferred — if a driver fails to construct, the error is stored internally and re-thrown as `ConfigError` with context when `get()` is called for that provider name. This distinguishes "provider not configured" from "provider failed to initialize". `[OBSERVED]` `NATIVE_DRIVERS` map only contains `{ anthropic: AnthropicDriver }` — `openai` and all other providers fall back to `OpenAIDriver` with a `baseURL` from presets. `[OBSERVED]` `DriverRegistry.register(name, DriverClass)` static method allows registering custom driver constructors at module level; must be called before `DriverRegistry` instantiation (or any `executePrompt()` call). `[OBSERVED]` `DriverRegistry.unregister(name)` static method removes a previously registered custom driver class — symmetric counterpart to `register()`, primarily useful in test teardown. `[OBSERVED]` `validateAll()` method throws a single `ConfigError` listing all providers that failed to initialize — called automatically by `executePrompt()` after registry construction (so misconfiguration surfaces before the first run, not mid-test).

#### Firmas relevantes

```typescript
class DriverRegistry {
  static register(name: string, DriverClass: new (opts: any) => AgentDriver): void
  static unregister(name: string): void
  constructor(config: TracepactConfig)
  getDefault(): AgentDriver
  get(name: string): AgentDriver
  getAll(): Map<string, AgentDriver>
  validateAll(): void
  async healthCheckAll(): Promise<Map<string, HealthCheckResult>>
}
```

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md) · [wiring.md — cómo se instancia](./wiring.md)

<!-- SOURCES: packages/core/src/driver/registry.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/driver/registry.ts`

```ts
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
<!-- END:GENERATED -->

---

### `executePrompt()`

- **Ubicación:** `packages/core/src/driver/execute.ts`
- **Clasificación:** orchestration
- **Responsabilidad:** Central orchestration function for all LLM execution. Handles provider resolution, registry caching, cache lookup/write, cassette replay/record, and optional health checks. Used by both `runSkill()` (vitest) and the CLI capture command.
- **Depende de:** `DriverRegistry`, `CacheStore`, `CassettePlayer`, `CassetteRecorder`, `MockSandbox`, `parseSkill`, `detectProvider`, `resolveConfig`, `log`
- **Dependencias externas:** `node:crypto` (for hashing)
- **Consumido por:** `runSkill()` (vitest package), CLI capture command
- **Entradas:** `ParsedSkill | string | { systemPrompt: string }`, `ExecutePromptOptions`
- **Salidas:** `RunResult`
- **Estado interno:** module-level `_registryCache: Map<string, DriverRegistry>` — reuses registry instances across calls when provider config is stable
- **Observaciones:** `[OBSERVED]` Replay mode short-circuits all driver/cache logic — if `opts.replay` is set, `CassettePlayer` handles the response directly and nothing else runs. `[OBSERVED]` Cache lookup uses a pre-run manifest built from stable fields (skillHash, promptHash, toolDefsHash, provider, model, temperature); the driver fills in `modelVersion`/`seed` post-run. `[OBSERVED]` `toolDefsHash` is computed via `stableStringify` (canonical key-sorted JSON) and passed to `player.replay()` for cassette hash validation. `[OBSERVED]` `cacheStatus` is set on all code paths: `'hit'` (cache hit), `'miss'` (live call, cache write succeeded), `'failed'` (live call, cache write failed), `'skipped'` (cache disabled), `'cassette_replay'` (cassette path). `[OBSERVED]` `RedactionPipeline` is applied to `RunResult` before returning in `executePrompt()` — the returned result is already redacted regardless of cache/cassette path. `[OBSERVED]` `validateAll()` is called on the registry immediately after construction — misconfigured providers are detected before the first run attempt. `[OBSERVED]` `TRACEPACT_NO_CACHE=1` env var disables cache reads and writes at runtime. `[OBSERVED]` Registry cache is keyed by provider name; bypassed when `tracepactConfig.providers` is overridden per-call (to avoid stale entries). `[OBSERVED]` `clearRegistryCache()` exported alongside `executePrompt()` for use in test teardown (`afterAll`) to prevent stale registries across suites that modify env vars. `[OBSERVED]` `opts.healthCheck` flag triggers a `driver.healthCheck()` call that logs to stderr before the actual run.

> **Lee también:** [flows.md — flujo de ejecución completo](./flows.md) · [wiring.md — cómo se inyecta](./wiring.md)

<!-- SOURCES: packages/core/src/driver/execute.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/driver/execute.ts`

```ts
// simplified
export interface ExecutePromptOptions {
  prompt: string;;
  sandbox?: MockSandbox;;
  tools?: TypedToolDefinition[];;
  config?: RunConfig;;
  tracepactConfig?: Partial<TracepactConfig>;;
  record?: string;;
  replay?: string;;
  stubs?: CassetteStub[];;
  replayStrict?: boolean;;
  provider?: string;;
  healthCheck?: boolean;;
}

export function clearRegistryCache(): void

export async function executePrompt(skill: string | ParsedSkill | { systemPrompt: string; }, opts: ExecutePromptOptions): Promise<RunResult>
```
<!-- END:GENERATED -->

---

### `resolve.ts` (provider resolution utilities)

- **Ubicación:** `packages/core/src/driver/resolve.ts`
- **Clasificación:** infrastructure / utility
- **Responsabilidad:** Auto-detects the active provider from environment variables, picks default models from the snapshot catalog, and builds a `TracepactConfig` from env vars and optional overrides.
- **Depende de:** `SNAPSHOT_PROVIDERS` (model catalog), `PROVIDER_ENV_KEYS` (presets), `defineConfig`
- **Dependencias externas:** none
- **Consumido por:** `executePrompt()`
- **Observaciones:** `[OBSERVED]` `detectProvider()` priority: `TRACEPACT_PROVIDER` env var > first provider whose API key env var is set (in `PROVIDER_ENV_KEYS` order) > `'openai'` fallback. `[OBSERVED]` `detectProvider()` emits `log.debug()` showing which provider was detected and why. `[OBSERVED]` `getDefaultModel()` prefers models tagged `'recommended'` in `SNAPSHOT_PROVIDERS`, falls back to first model, then to `'gpt-4o'` if the provider is unknown. `[OBSERVED]` `resolveConfig()` short-circuits to `defineConfig(overrides)` if `overrides.providers` is already set — allows callers to fully bypass auto-detection.

<!-- SOURCES: packages/core/src/driver/resolve.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/driver/resolve.ts`

```ts
export function getDefaultModel(provider: string): string

export function detectProvider(): string

export function resolveConfig(providerName: string, overrides: Partial<TracepactConfig>): TracepactConfig
```
<!-- END:GENERATED -->

---

### `RetryPolicy` + `Semaphore`

- **Ubicación:** `packages/core/src/driver/retry-policy.ts`, `packages/core/src/driver/semaphore.ts`
- **Clasificación:** infrastructure / utility
- **Responsabilidad:** `RetryPolicy` provides exponential backoff with jitter for API calls. `Semaphore` limits concurrent requests to a provider.
- **Depende de:** nothing
- **Dependencias externas:** none
- **Consumido por:** `AnthropicDriver`, `OpenAIDriver`
- **Estado interno:** `Semaphore` is stateful (queue of pending promises)
- **Observaciones:** `[OBSERVED]` Retryable HTTP status codes: 429, 500, 502, 503, 529. `[INFERRED]` `maxConcurrency` is per-provider, not global — concurrent runs across multiple providers are not coordinated. `[OBSERVED]` `Semaphore` accepts a `timeoutMs` constructor param — if an acquire waits longer than that threshold, a `log.warn` is emitted. `[OBSERVED]` `getQueueLength()` method returns the number of pending acquires waiting on the semaphore.

<!-- SOURCES: packages/core/src/driver/retry-policy.ts, packages/core/src/driver/semaphore.ts -->
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

### `packages/core/src/driver/retry-policy.ts`

```ts
export class RetryPolicy {
  constructor(config: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; })
  async execute(fn: () => Promise<T>): Promise<T>
  computeDelay(attempt: number, err: any): number
}
```

### `packages/core/src/driver/semaphore.ts`

```ts
export class Semaphore {
  constructor(max: number, timeoutMs: number)
  async run(fn: () => Promise<T>): Promise<T>
  getQueueLength(): number
}
```
<!-- END:GENERATED -->
