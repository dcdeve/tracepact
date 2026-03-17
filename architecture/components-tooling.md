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
- **Observaciones:** `[OBSERVED]` Four builtin rules: `toolComboRisk`, `promptHygiene`, `skillCompleteness`, `noOpaqueTools`. `[OBSERVED]` Constructor is optional (`rules?`) — defaults to `BUILTIN_RULES` when called without args (as CLI does). `[OBSERVED]` `AuditEngine` is immutable post-construction — there is no `addRule()` method; rules must be passed at construction time. `[OBSERVED]` Each `rule.check()` call is wrapped in try-catch — a rule that throws produces an error-level `AuditFinding` instead of propagating the exception.

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
- **Observaciones:** `[OBSERVED]` `connectMcp()` returns a `McpConnection` object that includes `handlers` and `sources` for injection into `MockSandbox`, completing the integration loop between MCP and the test sandbox.

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

---

### `tracepactPlugin` (Vitest Plugin)

- **Ubicación:** `packages/vitest/src/plugin.ts`
- **Clasificación:** adapter / integration
- **Responsabilidad:** Vitest plugin that reads env flags and `tracepact.config.*` to configure the global test run; filters tests based on `live`/`expensive`/`cheap` annotations; installs custom matchers.
- **Depende de:** `@tracepact/core`
- **Dependencias externas:** `vitest`
- **Consumido por:** user's `vitest.config.ts` via `plugins: [tracepactPlugin()]`
- **Entradas:** Vitest lifecycle hooks + env vars
- **Salidas:** modified Vitest behavior (test filtering, reporter injection, global setup)
- **Estado interno:** stateless (configuration is read once at plugin init)
- **Observaciones:** `[OBSERVED]` The plugin only configures three Vitest settings: `include` pattern (`['**/*.tracepact.ts', '**/*.tracepact.js']`), `setupFiles` (installs custom matchers), and `testTimeout`. The timeout reads `TRACEPACT_TEST_TIMEOUT` env var (ms), falling back to `30000`. It does NOT implement test filtering. `[OBSERVED]` `cheap()` / `expensive()` / `live()` test wrappers are defined in `test-live.ts` and `annotations.ts` and work independently of this plugin — they use `vitest.test.skipIf()` directly.

---

### `RedactionPipeline`

- **Ubicación:** `packages/core/src/redaction/`
- **Clasificación:** cross-cutting / infrastructure
- **Responsabilidad:** Scrubs sensitive data (API keys, credit cards, env var values) from strings and objects before they are written to the cache.
- **Depende de:** `RedactionConfig`
- **Dependencias externas:** none
- **Consumido por:** `CacheStore` before writing to disk, `CassetteRecorder` before writing cassettes `[OBSERVED]`
- **Estado interno:** stateless
- **Observaciones:** `[OBSERVED]` Applied in two places: `CacheStore.set()` before writing to disk (`cache-store.ts`), and `CassetteRecorder.save()` before writing cassettes to disk (`recorder.ts`). Both instantiate `RedactionPipeline` with the user-supplied `RedactionConfig` so custom rules and `redactEnvValues` are respected.
