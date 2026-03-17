> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Cómo se ensambla el sistema — inyección de dependencias, carga de config, env vars críticas y registro de plugins
> **Índice general:** [index.md](./index.md)

# Configuration & Wiring

### Dependency injection
`[OBSERVED]` Manual wiring — no DI container. `DriverRegistry` is constructed with `TracepactConfig` and instantiates drivers internally; instances are cached at the `execute.ts` module level keyed by `providerName + TRACEPACT_MODEL` (or skipped entirely when `tracepactConfig.providers` or `tracepactConfig.model` are set, forcing a fresh registry). `runSkill()` in the vitest package delegates to `executePrompt()` (core), which wires everything: resolves and caches a `DriverRegistry`, optionally a `CassetteRecorder`/`CassettePlayer`, a `CacheStore` (checked before the driver call and updated after), and uses the provided `MockSandbox`. `[OBSERVED]` `validateAll()` is called automatically on the registry right after construction in `executePrompt()` — misconfigured providers surface before the first LLM call, not mid-test. `[OBSERVED]` MCP connections opened during `runSkill()` are tracked in `_pendingMcpConnections`; `_closePendingMcpConnections()` is called by `setup.ts`'s `afterEach` hook to prevent connection leaks between tests. `[OBSERVED]` `detectProvider()` is exported from `@tracepact/core` and used directly by both `executePrompt()` and `packages/vitest/src/setup.ts` — there is a single canonical implementation.

### Config loading
`[OBSERVED]` `resolveConfig(providerName, overrides?)` in `packages/core/src/driver/resolve.ts` merges:
1. Default model from `SNAPSHOT_PROVIDERS` catalog (via `getDefaultModel()`), overridable by `TRACEPACT_MODEL`
2. API key from env using `PROVIDER_ENV_KEYS` (a map derived from `PROVIDER_PRESETS`, keyed by provider name → env var name)
3. User-supplied overrides

`PROVIDER_PRESETS` itself is not read by `resolveConfig()`; it is used by `registry.ts:createDriver()` to resolve `baseURL` for OpenAI-compatible providers.

The result is a fully populated `TracepactConfig`.

### Provider auto-detection
`[OBSERVED]` `detectProvider()` checks in order: `TRACEPACT_PROVIDER` env var → first available API key by iterating over all entries in `PROVIDER_ENV_KEYS` (`packages/core/src/driver/presets.ts`). `PROVIDER_ENV_KEYS` is built from `openai` + `anthropic` plus every entry in `PROVIDER_PRESETS` (groq, deepseek, together, mistral, openrouter, xai, cerebras, fireworks, perplexity) — all eleven providers are candidates for auto-detection. Falls back to `'openai'` if no key is found.

### Env vars (critical)

| Variable | Purpose |
|----------|---------|
| `TRACEPACT_PROVIDER` | Force provider (anthropic, openai, groq, ...) |
| `TRACEPACT_MODEL` | Force model ID |
| `ANTHROPIC_API_KEY` | Anthropic auth |
| `OPENAI_API_KEY` | OpenAI auth |
| `GROQ_API_KEY` | Groq auth (+ 8 other provider keys: deepseek, together, mistral, openrouter, xai, cerebras, fireworks, perplexity) |
| `TRACEPACT_LIVE` | Enable real API calls in tests |
| `TRACEPACT_FULL` | Include Tier 3/4 expensive tests |
| `TRACEPACT_RECORD` | Record cassettes during live runs |
| `TRACEPACT_REPLAY` | Directory path for cassette replay |
| `TRACEPACT_CASSETTE_DIR` | Directory where cassette files are stored; defaults to `cassettes` (`packages/vitest/src/run-skill.ts:135`) |
| `TRACEPACT_NO_CACHE` | Disables the filesystem cache in `executePrompt()`. Set to `'1'` to skip both cache read and cache write. CLI sets this via `--no-cache` flag. |
| `TRACEPACT_TEST_TIMEOUT` | Override test timeout in ms for `tracepactPlugin` (default: `30000`). |
| `TRACEPACT_BUDGET` | Max token spend per run |
| `TRACEPACT_HEALTH_CHECK_STRICT` | Fail if provider health check fails |
| `TRACEPACT_LOG` | Log level: debug, info, warn, error |
| `TRACEPACT_JSON_REPORTER` | Enable JSON reporter in Vitest (defined in CLI, not consumed by vitest plugin) |

### Plugin / route registration
`[OBSERVED]` Vitest plugin (`tracepactPlugin`) registers custom matchers via Vitest's `expect.extend()` in `packages/vitest/src/setup.ts`. MCP tools are registered declaratively in `packages/mcp-server/src/index.ts` using `server.registerTool()`.
