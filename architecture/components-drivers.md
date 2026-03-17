> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Componentes del subsistema de drivers — la capa que abstrae los AI providers (Anthropic, OpenAI) y controla la ejecución del agentic loop
> **Índice general:** [index.md](./index.md)

# Architectural Components — Drivers

Otros grupos de componentes: [components-testing.md](./components-testing.md) · [components-tooling.md](./components-tooling.md)

---

### `AgentDriver` (interface)

- **Ubicación:** `packages/core/src/driver/`
- **Clasificación:** core domain (interface / contract)
- **Responsabilidad:** Defines the contract for running a skill against any AI provider. All provider-specific logic lives behind this interface.
- **Depende de:** `RunInput`, `RunResult`, `ToolTrace`, `MockSandbox`
- **Dependencias externas:** none (it's a contract)
- **Consumido por:** `DriverRegistry`, `runSkill()`, `executePrompt()`, `JudgeExecutor`
- **Entradas:** `RunInput` (skill, prompt, tools, sandbox, conversation, config)
- **Salidas:** `RunResult` (output, trace, messages, usage, duration, runManifest)
- **Estado interno:** stateless
- **Observaciones:** `[OBSERVED]` Clean interface. Capabilities struct (`DriverCapabilities`) lets callers query feature support (seed, streaming, parallelToolCalls) without casting.

#### Firmas relevantes

```typescript
interface AgentDriver {
  readonly name: string;
  readonly capabilities: DriverCapabilities;
  run(input: RunInput): Promise<RunResult>;
  healthCheck(): Promise<HealthCheckResult>;
}

interface DriverCapabilities {
  seed: boolean;
  parallelToolCalls: boolean;
  streaming: boolean;
  systemPromptRole: boolean;
  maxContextWindow: number;
}
```

---

### `AnthropicDriver`

- **Ubicación:** `packages/core/src/driver/anthropic-driver.ts`
- **Clasificación:** infrastructure / adapter
- **Responsabilidad:** Implements `AgentDriver` for the Anthropic API. Runs the agentic tool-use loop (text → tool calls → tool results → text) with optional streaming.
- **Depende de:** `RetryPolicy`, `Semaphore`, `computeManifest` (cache), `DEFAULT_MAX_TOOL_ITERATIONS`/`DEFAULT_TEMPERATURE` (config), `DriverError`
- **Dependencias externas:** `@anthropic-ai/sdk` (optional peer dependency, loaded with dynamic `import()`)
- **Consumido por:** `DriverRegistry`
- **Entradas:** `RunInput`
- **Salidas:** `RunResult`
- **Estado interno:** stateless
- **Observaciones:** `[OBSERVED]` Dynamic import of SDK means the package is optional — if missing at runtime, `getClient()` throws a `DriverError` with explicit install instructions (`npm install @anthropic-ai/sdk`), not a generic "Cannot find module". `[OBSERVED]` The 200k context window value is hardcoded in capabilities, not queried from the API. `[OBSERVED]` `run()` enforces capability contracts: requesting `stream: true` on a driver with `capabilities.streaming === false` throws immediately.

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
```

---

### `OpenAIDriver`

- **Ubicación:** `packages/core/src/driver/openai-driver.ts`
- **Clasificación:** infrastructure / adapter
- **Responsabilidad:** Implements `AgentDriver` for OpenAI (and compatible) APIs. Supports seed for deterministic runs.
- **Depende de:** `RetryPolicy`, `Semaphore`, `computeManifest` (cache), `DEFAULT_MAX_TOOL_ITERATIONS`/`DEFAULT_TEMPERATURE` (config), `DriverError`, `log` (logger)
- **Dependencias externas:** `openai` (direct dependency)
- **Consumido por:** `DriverRegistry`
- **Entradas:** `RunInput`
- **Salidas:** `RunResult`
- **Estado interno:** stateless
- **Observaciones:** `[OBSERVED]` Dual code paths: streaming vs non-streaming, both share a single `executeToolCalls()` private method — tool execution logic and error handling are consistent across both modes. `[OBSERVED]` `baseURL` override enables routing to any OpenAI-compatible endpoint (Groq, Together, etc.) — this is how the ~10 provider presets work without separate driver implementations. `[OBSERVED]` `run()` enforces capability contracts: requesting `stream: true` on a driver with `capabilities.streaming === false` throws immediately.

#### Firmas relevantes

```typescript
capabilities = {
  seed: true,
  parallelToolCalls: true,
  streaming: true,
  systemPromptRole: true,
  maxContextWindow: 128000,
}
```

---

### `DriverRegistry`

- **Ubicación:** `packages/core/src/driver/`
- **Clasificación:** orchestration
- **Responsabilidad:** Builds and holds all configured `AgentDriver` instances. Acts as service locator for drivers.
- **Depende de:** `TracepactConfig`, `AnthropicDriver`, `OpenAIDriver`
- **Dependencias externas:** none
- **Consumido por:** `executePrompt()` (core) — es el único lugar donde se instancia en producción. `runSkill()` lo usa indirectamente a través de `executePrompt()`. `healthCheckAll()` solo se usa en tests.
- **Entradas:** `TracepactConfig`
- **Salidas:** `AgentDriver` instances
- **Estado interno:** stateful — holds a `Map<string, AgentDriver>`
- **Observaciones:** `[OBSERVED]` `getDefault()` returns the driver for the `providers.default` key in config. `[OBSERVED]` Initialization errors are deferred — if a driver fails to construct, the error is stored internally and re-thrown as `ConfigError` with context when `get()` is called for that provider name. This distinguishes "provider not configured" from "provider failed to initialize". `[OBSERVED]` Driver instantiation uses a `NATIVE_DRIVERS` map (`{ anthropic: AnthropicDriver, openai: OpenAIDriver, ... }`) — adding a new native driver requires only a new entry in the map.

#### Firmas relevantes

```typescript
class DriverRegistry {
  constructor(config: TracepactConfig)
  getDefault(): AgentDriver
  get(name: string): AgentDriver
  getAll(): Map<string, AgentDriver>
  async healthCheckAll(): Promise<Map<string, HealthCheckResult>>
}
```

---

### `RetryPolicy` + `Semaphore`

- **Ubicación:** `packages/core/src/driver/`
- **Clasificación:** infrastructure / utility
- **Responsabilidad:** `RetryPolicy` provides exponential backoff with jitter for API calls. `Semaphore` limits concurrent requests to a provider.
- **Depende de:** nothing
- **Dependencias externas:** none
- **Consumido por:** `AnthropicDriver`, `OpenAIDriver`
- **Estado interno:** `Semaphore` is stateful (queue of pending promises)
- **Observaciones:** `[OBSERVED]` Retryable HTTP status codes: 429, 500, 502, 503, 529. `[INFERRED]` `maxConcurrency` is per-provider, not global — concurrent runs across multiple providers are not coordinated.

#### Firmas relevantes

```typescript
class RetryPolicy {
  constructor(config?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number })
  async execute<T>(fn: () => Promise<T>): Promise<T>
}

class Semaphore {
  constructor(max: number)
  async run<T>(fn: () => Promise<T>): Promise<T>
}
```
