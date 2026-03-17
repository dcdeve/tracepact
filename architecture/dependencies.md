> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Dependencias externas (npm, Node built-ins) e internas (módulos compartidos entre paquetes)
> **Índice general:** [index.md](./index.md)

# Dependencies

## Externas

| Dependencia | Tipo | Usado por | Propósito |
|-------------|------|-----------|-----------|
| `openai` | npm (direct) | `core/driver/openai-driver.ts`, `core/matchers/` | OpenAI API + embeddings |
| `@anthropic-ai/sdk` | npm (optional peer) | `core/driver/anthropic-driver.ts` | Anthropic API (dynamic import) |
| `@modelcontextprotocol/sdk` | npm | `core/mcp/` (`^1.27.1`), `mcp-server/` (`^1.27.1`) | MCP client + server protocol |
| `yaml` | npm | `core/parser/`, `core/scenarios/` | YAML frontmatter parsing |
| `stemmer` | npm | `core/matchers/tier2/` | Word stemming for `toMention()` |
| `commander` | npm | `cli/` | CLI framework |
| `@clack/prompts` | npm | `cli/` | Interactive CLI prompts |
| `zod` | npm (optional peer) | `core/tools/`; `mcp-server/src/tools/schemas.ts` | Tool schema definition (Zod v3/v4). Declared as `peerDependencies` in both `core/` and `mcp-server/`. |
| `vitest` | npm (peer in `vitest/`; devDependency in `core/`) | `vitest/` | Test runner integration |
| `node:fs`, `node:crypto`, `node:path` | Node built-in | `core/cache/`, `core/cassette/`, `core/parser/` | File I/O, hashing |

## Internas (shared)

| Módulo | Consumidores | Propósito |
|--------|-------------|-----------|
| `@tracepact/core` | cli, vitest, mcp-server, promptfoo | All primitives — every integration package re-exports from here |
| `core/src/logger.ts` | All core modules | Centralized logging |
| `core/src/errors/` | All core modules | Typed error hierarchy |
| `core/src/config/` | All packages | `TracepactConfig` schema + `defineConfig()` |
