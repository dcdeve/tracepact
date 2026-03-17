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

---

## Complete listing (all packages)

<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

> Auto-extracted from package.json files across the monorepo

### Root devDependencies

| Package | Version |
|---------|---------|
| `@biomejs/biome` | `^1.9.0` |
| `@changesets/changelog-github` | `^0.6.0` |
| `@changesets/cli` | `^2.30.0` |
| `husky` | `^9.1.7` |
| `ts-morph` | `^24.0.0` |
| `tsx` | `^4.21.0` |
| `typescript` | `^5.5.0` |
| `vitepress` | `^1.6.4` |

## `packages/cli`

### Production

| Package | Version |
|---------|---------|
| `@clack/prompts` | `^1.1.0` |
| `@tracepact/core` | `0.5.0` |
| `commander` | `^14.0.3` |

### Dev

| Package | Version |
|---------|---------|
| `@types/node` | `^25.3.5` |
| `tsup` | `^8.0.0` |
| `typescript` | `^5.5.0` |
| `vitest` | `^2.1.0` |

## `packages/core`

### Production

| Package | Version |
|---------|---------|
| `@modelcontextprotocol/sdk` | `^1.27.1` |
| `openai` | `^6.27.0` |
| `stemmer` | `^2.0.1` |
| `yaml` | `^2.6.0` |

### Dev

| Package | Version |
|---------|---------|
| `@modelcontextprotocol/server-filesystem` | `^2026.1.14` |
| `tsup` | `^8.3.0` |
| `typescript` | `^5.5.0` |
| `vitest` | `^2.1.0` |
| `zod` | `^3.23.0` |

### Peer

| Package | Version |
|---------|---------|
| `@anthropic-ai/sdk` | `>=0.30.0` |
| `zod` | `>=3.22.0` |

## `packages/mcp-server`

### Production

| Package | Version |
|---------|---------|
| `@modelcontextprotocol/sdk` | `^1.27.1` |
| `@tracepact/core` | `0.5.0` |

### Dev

| Package | Version |
|---------|---------|
| `@types/node` | `^25.3.5` |
| `tsup` | `^8.0.0` |
| `typescript` | `^5.5.0` |
| `vitest` | `^2.1.0` |

### Peer

| Package | Version |
|---------|---------|
| `zod` | `>=3.22.0` |

## `packages/promptfoo`

### Production

| Package | Version |
|---------|---------|
| `@tracepact/core` | `0.5.0` |

### Dev

| Package | Version |
|---------|---------|
| `tsup` | `^8.3.0` |
| `typescript` | `^5.5.0` |
| `vitest` | `^2.1.0` |

### Peer

| Package | Version |
|---------|---------|
| `promptfoo` | `>=0.80.0` |

## `packages/vitest`

### Production

| Package | Version |
|---------|---------|
| `@tracepact/core` | `0.5.0` |

### Dev

| Package | Version |
|---------|---------|
| `tsup` | `^8.3.0` |
| `typescript` | `^5.5.0` |
| `vitest` | `^2.1.0` |

### Peer

| Package | Version |
|---------|---------|
| `vitest` | `>=2.0.0` |
<!-- END:GENERATED -->
