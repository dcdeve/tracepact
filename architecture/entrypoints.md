> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Puntos de entrada del sistema — binarios, integraciones y adapters que arrancan la ejecución
> **Índice general:** [index.md](./index.md)

# Entrypoints

### `tracepact` (CLI binary)
- **Path:** `packages/cli/src/index.ts`
- **Tipo:** CLI (`commander`-based)
- **Inicializa:** `createProgram()` registers all subcommands; config resolution happens inside each individual handler (not in `createProgram()`)
- **Comandos registrados:** `run`, `init`, `audit`, `capture`, `cache` (subcommands: `list`, `clear`, `verify`), `cost-report`, `models`, `diff`, `doctor`
- **Transfiere control a:** one of the command handlers — `run` delegates to Vitest process; `audit` creates `AuditEngine`; `capture` calls `executePrompt()` from core; `diff` calls `diffCassettes()`; `models` calls `listProviders()`; `doctor` runs local environment checks (Node version, Vitest presence, config file, API keys)

### `runSkill()` (Vitest integration)
- **Path:** `packages/vitest/src/run-skill.ts`
- **Tipo:** Programmatic entrypoint (called from test files)
- **Inicializa:** checks `TRACEPACT_LIVE`/`TRACEPACT_REPLAY` env vars, optionally builds `MockSandbox` from MCP connections, then delegates to `executePrompt()`
- **Transfiere control a:** `executePrompt()` (core) → `detectProvider()` → `resolveConfig()` → `new DriverRegistry(config)` → `registry.get(providerName)` → `AgentDriver.run()`

### `tracepact-mcp-server` (MCP server binary)
- **Path:** `packages/mcp-server/src/index.ts`
- **Tipo:** Long-running MCP server (stdio transport)
- **Inicializa:** `McpServer` instance from `@modelcontextprotocol/sdk`, registers 6 tools
- **Transfiere control a:** each registered tool handler invokes the corresponding core function (`AuditEngine`, `executePrompt`, `diffCassettes`, etc.)

### `TracepactProvider` (Promptfoo integration)
- **Path:** `packages/promptfoo/src/provider.ts`
- **Tipo:** Promptfoo provider adapter
- **Inicializa:** resolves config, builds `MockSandbox` from `tools` config, instantiates `OpenAIDriver` directly (bypasses `DriverRegistry` — supports only OpenAI-compatible providers)
- **Transfiere control a:** `driver.run()` directly (does not use `executePrompt()`)
