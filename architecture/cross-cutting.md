> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Concerns transversales — error handling, logging, auth/API keys, validación y token budget
> **Índice general:** [index.md](./index.md)

# Cross-Cutting Concerns

### Error Handling
- **Estrategia:** Mixta — typed errors for known conditions, unhandled rejections for unexpected failures
- **Implementación:** `[OBSERVED]` `TracepactError` hierarchy in `core/src/errors/` — `ConfigError`, `DriverError`, `SkillParseError` each carry structured fields. Retry logic in `RetryPolicy` catches API errors by status code.
- **Gaps:** `[OBSERVED]` MCP server tool handlers do not have a unified error wrapping layer — each handler (`audit.ts`, `capture.ts`, `diff.ts`, `replay.ts`, `run.ts`, `list-tests.ts`) has its own ad-hoc try-catch.

### Logging
- **Estrategia:** Consistent
- **Implementación:** `[OBSERVED]` Single `log` object from `core/src/logger.ts`, level configurable via `TRACEPACT_LOG` env var (also via `initLogLevelFromEnv()` called at module init in `packages/vitest/src/setup.ts`). `[OBSERVED]` Log level routing: `debug`/`info` → `console.log()`, `warn` → `console.warn()`, `error` → `console.error()`. Used throughout core modules. `[OBSERVED]` `initLogLevelFromEnv` is re-exported from `packages/core/src/index.ts`.
- **Gaps:** No structured logging (no JSON log format), no trace IDs to correlate log lines with specific runs.

### Auth / API Key Management
- **Estrategia:** Env var convention
- **Implementación:** `[OBSERVED]` API keys are read from env vars in `resolveConfig()`. `RedactionPipeline` scrubs known API key patterns from strings.
- **Gaps:** `[INFERRED]` Keys are passed directly to SDK constructors — no secret rotation, no vault integration. `redactEnvValues` in `RedactionConfig` must be manually populated to redact specific env var values.

### Validation
- **Estrategia:** Boundary validation only
- **Implementación:** `[OBSERVED]` `parseSkill()` validates frontmatter structure and file size. `defineConfig()` applies defaults. `loadScenarios()` validates that input is an array with `name` fields.
- **Gaps:** `[OBSERVED]` `MockSandbox.executeTool()` validates tool args against the declared JSON schema only when `strict: true` is passed in `MockSandboxOptions` **and** the tool is registered as a `MockToolEntry` (i.e., an object with `impl` + `schema`). Tools registered as plain functions (no schema) are never validated even in strict mode. By default `strict` is `false` (backward-compatible), so without opt-in an agent passing wrong types gets whatever the mock returns rather than a schema error. `[OBSERVED]` When strict validation is enabled, `validateArgs` checks an extended set of JSON Schema keywords: nested objects, `enum`, `minLength`, `maxLength`, `pattern`, and array `items` — not just top-level type checks.

### Token Budget
- **Estrategia:** Opt-in via `TRACEPACT_BUDGET`
- **Implementación:** `[OBSERVED]` `TokenAccumulator` in `core/src/cost/` tracks live vs cached tokens separately. `exceedsBudget()` checked during runs.
- **Gaps:** `[OBSERVED]` `exceedsBudget()` is checked in `packages/vitest/src/token-tracker.ts` inside `trackUsage()`, which is called after each live LLM call in `runSkill()`. When budget is exceeded it throws immediately, stopping the run mid-loop.
