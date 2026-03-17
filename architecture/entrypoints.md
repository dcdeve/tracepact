> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Puntos de entrada del sistema — binarios, integraciones y adapters que arrancan la ejecución
> **Índice general:** [index.md](./index.md)

# Entrypoints

<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

> Auto-detected entry points based on code patterns and package.json files

## Root package.json — scripts

| Script | Command |
|--------|---------|
| `build` | `npm run build -w packages/core && npm run build -w packages/vitest -w packages/cli -w packages/promptfoo -w packages/mcp-server` |
| `test` | `npm run test --workspaces --if-present` |
| `lint` | `npx biome check .` |
| `lint:fix` | `npx biome check --write .` |
| `typecheck` | `npm run typecheck --workspaces --if-present` |
| `clean` | `rm -rf packages/*/dist` |
| `changeset` | `changeset` |
| `version` | `changeset version` |
| `release` | `npm run build && changeset publish` |
| `prepare` | `husky` |
| `generate:arch` | `npx tsx scripts/generate-architecture.ts --out architecture` |

## Per-package exports & bin

### `packages/cli`


**bin:**
- `tracepact` → `dist/index.js`

### `packages/core`


**exports:**
```json
{
  ".": {
    "import": "./dist/index.js",
    "types": "./dist/index.d.ts"
  }
}
```

### `packages/mcp-server`


**bin:**
- `tracepact-mcp-server` → `dist/index.js`

### `packages/promptfoo`

- **main:** `./dist/index.cjs`

**exports:**
```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  }
}
```

### `packages/vitest`


**exports:**
```json
{
  ".": {
    "import": "./dist/index.js",
    "types": "./dist/index.d.ts"
  },
  "./setup": {
    "import": "./dist/setup.js"
  }
}
```

## Detected in code

| File | Pattern | Line |
|------|---------|------|
| `packages/cli/src/index.ts` | `process.argv` | 121 |
| `packages/cli/src/commands/run.ts` | `commander` | 9 |
| `packages/cli/src/patterns/templates.ts` | `export function main` | 83 |
<!-- END:GENERATED -->

### `tracepact` (CLI binary)
- **Path:** `packages/cli/src/index.ts`
- **Tipo:** CLI (`commander`-based)
- **Inicializa:** `createProgram()` registers all subcommands; config resolution happens inside each individual handler (not in `createProgram()`)
- **Comandos registrados:** `run`, `init`, `audit`, `capture`, `cache` (subcommands: `list`, `clear`, `verify`), `cost-report`, `models`, `diff`, `doctor`
- **Transfiere control a:** one of the command handlers — `run` delegates to Vitest process; `audit` creates `AuditEngine`; `capture` calls `executePrompt()` from core; `diff` calls `diffCassettes()`; `models` calls `listProviders()`; `doctor` runs local environment checks (Node version, Vitest presence, config file, API keys)

### `runSkill()` (Vitest integration)
- **Path:** `packages/vitest/src/run-skill.ts`
- **Tipo:** Programmatic entrypoint (called from test files)
- **Inicializa:** checks `TRACEPACT_LIVE`/`TRACEPACT_REPLAY` env vars, optionally builds `MockSandbox` from MCP connections, tracks open connections in `_pendingMcpConnections`, then delegates to `executePrompt()`
- **Transfiere control a:** `executePrompt()` (core) → `detectProvider()` → `resolveConfig()` → `new DriverRegistry(config)` → `validateAll()` → `registry.get(providerName)` → `AgentDriver.run()`

### `tracepact-mcp-server` (MCP server binary)
- **Path:** `packages/mcp-server/src/index.ts`
- **Tipo:** Long-running MCP server (stdio transport)
- **Inicializa:** `McpServer` instance from `@modelcontextprotocol/sdk`, registers 6 tools
- **Transfiere control a:** each registered tool handler invokes the corresponding core function (`AuditEngine`, `executePrompt`, `diffCassettes`, etc.)

### `TracepactProvider` (Promptfoo integration)
- **Path:** `packages/promptfoo/src/provider.ts`
- **Tipo:** Promptfoo provider adapter
- **Inicializa:** resolves config, builds `MockSandbox` from `tools` config, resolves provider name from config (default `"openai"`)
- **Transfiere control a:** `executePrompt()` from `@tracepact/core` (uses `DriverRegistry` — supports all providers including Anthropic, OpenAI-compatible, xai, etc.)
