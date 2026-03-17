> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Estructura de directorios del repositorio y diagrama de dependencias entre paquetes
> **Índice general:** [index.md](./index.md)
# Repository Shape
<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

> Auto-generated directory structure (depth 2)

```
├── architecture
│   ├── components-drivers.md
│   ├── components-testing.md
│   ├── components-tooling.md
│   ├── cross-cutting.md
│   ├── dependencies.md
│   ├── entrypoints.md
│   ├── env-vars.md
│   ├── flows.md
│   ├── import-graph.md
│   ├── index.md
│   ├── interfaces.md
│   ├── inventory.md
│   ├── REVIEW.md
│   ├── shape.md
│   ├── signatures.md
│   ├── tech-debt.md
│   └── wiring.md
├── docs
│   ├── advanced
│   │   ├── cassettes.md
│   │   ├── flake-scoring.md
│   │   ├── judge-assertions.md
│   │   └── semantic-assertions.md
│   ├── guide
│   │   ├── ci-integration.md
│   │   ├── ide-setup.md
│   │   ├── mock-vs-live.md
│   │   ├── quick-start.md
│   │   └── skills-sh.md
│   ├── reference
│   │   ├── assertions.md
│   │   ├── cli.md
│   │   └── configuration.md
│   ├── index.md
│   ├── judge-assertions.md
│   └── promptfoo-integration.md
├── examples
│   ├── agent-example
│   │   ├── cassettes
│   │   ├── tests
│   │   ├── README.md
│   │   └── SKILL.md
│   ├── cross-provider
│   │   ├── cross-provider.tracepact.ts
│   │   ├── tracepact.config.ts
│   │   └── tracepact.vitest.ts
│   ├── filesystem
│   │   ├── basic.tracepact.ts
│   │   ├── constraints.tracepact.ts
│   │   ├── integration.tracepact.ts
│   │   ├── prompt-injection.tracepact.ts
│   │   └── vitest.config.ts
│   └── promptfoo
│       ├── doc-writer
│       └── security-reviewer
├── experimental
│   └── IDEAS.md
├── packages
│   ├── cli
│   │   ├── src
│   │   ├── test
│   │   ├── CHANGELOG.md
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── core
│   │   ├── src
│   │   ├── test
│   │   ├── CHANGELOG.md
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.check.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── mcp-server
│   │   ├── src
│   │   ├── test
│   │   ├── CHANGELOG.md
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── promptfoo
│   │   ├── src
│   │   ├── test
│   │   ├── CHANGELOG.md
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.check.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   └── vitest
│       ├── src
│       ├── test
│       ├── CHANGELOG.md
│       ├── package.json
│       ├── README.md
│       ├── tsconfig.json
│       └── tsup.config.ts
├── scripts
│   └── generate-architecture.ts
├── TODO
│   ├── claude-code.md
│   └── mcp.md
├── biome.json
├── CHANGELOG.md
├── CLAUDE.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── llms-full.txt
├── llms.txt
├── Makefile
├── package-lock.json
├── package.json
├── README.md
├── SECURITY.md
├── SKILL.md
├── skills-lock.json
└── tsconfig.base.json
```

## Directory Roles

| Path | Type | Files | Lines |
|------|------|-------|-------|
| `TODO/` | directory | 2 | 0 |
| `architecture/` | directory | 17 | 0 |
| `docs/` | docs | 15 | 0 |
| `examples/` | directory | 18 | 776 |
| `experimental/` | directory | 1 | 0 |
| `packages/` | packages | 204 | 17672 |
| `scripts/` | scripts | 1 | 958 |

## Package internals

> Subdirectories of `packages/*/src/` (depth 1)

| Package | Module | Files | Lines |
|---------|--------|-------|-------|
| `packages/cli` | `src/commands/` | 9 | 1129 |
| `packages/cli` | `src/patterns/` | 1 | 191 |
| `packages/cli` | `src/index.ts` | 1 | 122 |
| `packages/core` | `src/audit/` | 4 | 306 |
| `packages/core` | `src/cache/` | 2 | 297 |
| `packages/core` | `src/capture/` | 3 | 212 |
| `packages/core` | `src/cassette/` | 5 | 348 |
| `packages/core` | `src/config/` | 3 | 133 |
| `packages/core` | `src/cost/` | 1 | 68 |
| `packages/core` | `src/driver/` | 10 | 1352 |
| `packages/core` | `src/errors/` | 4 | 45 |
| `packages/core` | `src/flake/` | 1 | 97 |
| `packages/core` | `src/matchers/` | 22 | 2756 |
| `packages/core` | `src/mcp/` | 2 | 168 |
| `packages/core` | `src/models/` | 4 | 512 |
| `packages/core` | `src/parser/` | 3 | 152 |
| `packages/core` | `src/redaction/` | 3 | 80 |
| `packages/core` | `src/sandbox/` | 13 | 954 |
| `packages/core` | `src/scenarios/` | 1 | 67 |
| `packages/core` | `src/tools/` | 2 | 119 |
| `packages/core` | `src/trace/` | 2 | 92 |
| `packages/core` | `src/index.ts` | 1 | 255 |
| `packages/core` | `src/logger.ts` | 1 | 51 |
| `packages/mcp-server` | `src/tools/` | 7 | 351 |
| `packages/mcp-server` | `src/index.ts` | 1 | 143 |
| `packages/promptfoo` | `src/assertions.ts` | 1 | 106 |
| `packages/promptfoo` | `src/index.ts` | 1 | 15 |
| `packages/promptfoo` | `src/provider.ts` | 1 | 149 |
| `packages/vitest` | `src/annotations.ts` | 1 | 16 |
| `packages/vitest` | `src/augment.d.ts` | 1 | 45 |
| `packages/vitest` | `src/index.ts` | 1 | 44 |
| `packages/vitest` | `src/json-reporter.ts` | 1 | 67 |
| `packages/vitest` | `src/matchers.ts` | 1 | 198 |
| `packages/vitest` | `src/plugin.ts` | 1 | 24 |
| `packages/vitest` | `src/run-skill.ts` | 1 | 161 |
| `packages/vitest` | `src/setup.ts` | 1 | 74 |
| `packages/vitest` | `src/test-live.ts` | 1 | 10 |
| `packages/vitest` | `src/token-tracker.ts` | 1 | 47 |
<!-- END:GENERATED -->
## Roles arquitectónicos
| Path | Tipo | Rol arquitectónico | Notas |
|------|------|--------------------|-------|
| `packages/core/` | Package | Core domain library | All primitives: driver, matchers, cache, cassette, sandbox |
| `packages/core/src/config/` | Module | Config schema + defaults | `defineConfig()`, `TracepactConfig` type |
| `packages/core/src/driver/` | Module | AI provider adapters | `AgentDriver` interface, `AnthropicDriver`, `OpenAIDriver`, `DriverRegistry` |
| `packages/core/src/matchers/` | Module | Assertion engine | Tiered matchers (Tier 0–4), RAG, MCP, conditional |
| `packages/core/src/cassette/` | Module | Record/replay I/O | `CassetteRecorder`, `CassettePlayer`, `diffCassettes` |
| `packages/core/src/cache/` | Module | Filesystem run cache | `CacheStore`, `RunManifest`, hash-based keying |
| `packages/core/src/sandbox/` | Module | Mock tool environment | `MockSandbox`, `mockReadFile`, `mockBash`, etc. |
| `packages/core/src/trace/` | Module | Tool call recording | `ToolTrace`, `TraceBuilder` |
| `packages/core/src/tools/` | Module | Tool definition DSL | `defineTools()`, Zod → JSON Schema bridge |
| `packages/core/src/mcp/` | Module | MCP client | `McpClient`, `connectMcp()` |
| `packages/core/src/parser/` | Module | Skill file parser | `parseSkill()`, frontmatter + hash |
| `packages/core/src/audit/` | Module | Static skill analysis | `AuditEngine`, builtin rules |
| `packages/core/src/capture/` | Module | Test scaffolding gen | `analyzeTrace()`, `generateTestFile()` |
| `packages/core/src/redaction/` | Module | Secrets scrubbing | `RedactionPipeline` |
| `packages/core/src/models/` | Module | Provider/model registry | `listProviders()`, `getRecommended()` |
| `packages/core/src/cost/` | Module | Token budget tracking | `TokenAccumulator` |
| `packages/core/src/flake/` | Module | Flaky test detection | `FlakeStore` |
| `packages/core/src/calibration-sets/` | Directory | Directorio de ejemplos de calibración custom (YAML) para el judge Tier 4 | Los ejemplos bundled (`code-review`, `deploy`, `documentation`) están hardcodeados en TypeScript en `matchers/tier4/calibration.ts` (`BUNDLED_SETS`); este directorio existe pero sus YAMLs no son consumidos por el código |
| `packages/core/src/scenarios/` | Module | Parameterized test loader | `loadScenarios()` |
| `packages/core/src/errors/` | Module | Error class hierarchy | `TracepactError`, `ConfigError`, `DriverError`, `SkillParseError` |
| `packages/core/src/logger.ts` | File | Logging | `log.{debug,info,warn,error}`, env-driven level |
| `packages/cli/` | Package | CLI entrypoint | `tracepact` binary, `commander`-based |
| `packages/vitest/` | Package | Vitest integration | Plugin, `runSkill()`, custom matchers, JSON reporter |
| `packages/mcp-server/` | Package | MCP server | Exposes 6 tools to agentic IDEs |
| `packages/promptfoo/` | Package | Promptfoo integration | `TracepactProvider`, assertion helpers |
| `package.json` | Root | Workspace definition | Node >=20, turbo build |
| `tsconfig.base.json` | Root | TS config base | ES2022, strict, ESM |
| `biome.json` | Root | Linter/formatter | Spaces, 100-char lines |
| `Makefile` | Root | Build automation | — |
| `.husky/pre-commit` | Root | Git hook | Runs `npx biome check --write . && git add -u && npm run typecheck && npm run build && npm test` |
