> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Interfaces y contratos explícitos que definen los boundaries entre módulos
> **Índice general:** [index.md](./index.md)

# Interfaces & Contracts

### `AgentDriver`
- **Ubicación:** `packages/core/src/driver/`
- **Define el contrato entre:** Core orchestration (`runSkill`, `executePrompt`) ↔ Provider implementations (`AnthropicDriver`, `OpenAIDriver`)
- **Firma:**

```typescript
interface AgentDriver {
  readonly name: string;
  readonly capabilities: DriverCapabilities;
  run(input: RunInput): Promise<RunResult>;
  healthCheck(): Promise<HealthCheckResult>;
}
```

---

### `MockToolImpl`
- **Ubicación:** `packages/core/src/sandbox/`
- **Define el contrato entre:** `MockSandbox` ↔ user-supplied mock functions AND `McpClient` handlers
- **Firma:**

```typescript
type MockToolImpl = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>
```

> **[OBSERVED]** This type is the unifying contract between user-written test mocks and MCP-sourced tool handlers — both must satisfy it to be registered in `MockSandbox`.

---

### `Sandbox`
- **Ubicación:** `packages/core/src/sandbox/types.ts`
- **Define el contrato entre:** `executePrompt()` / `runSkill()` ↔ `MockSandbox`, `ProcessSandbox`, `ContainerSandbox`
- **Firma:**

```typescript
interface Sandbox {
  executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  getTrace(): ToolTrace;
  getWrites(): ReadonlyArray<WriteCapture>;
}
```

> **[OBSERVED]** All three concrete sandbox classes declare `implements Sandbox`. `ExecutePromptOptions.sandbox` is typed as `Sandbox` (the interface), not `MockSandbox` — any conforming sandbox can be passed to `executePrompt()`.

---

### `AuditRule`
- **Ubicación:** `packages/core/src/audit/`
- **Define el contrato entre:** `AuditEngine` ↔ individual rule implementations
- **Firma:**

```typescript
interface AuditRule {
  readonly name: string;
  readonly description: string;
  readonly check: (input: AuditInput) => AuditFinding[];
}
```

> **[OBSERVED]** `check` is synchronous — rules that need I/O must be refactored to async when the contract is updated.

---

### `McpClientConfig`
- **Ubicación:** `packages/core/src/mcp/client.ts`
- **Define el contrato entre:** `McpClient` constructor ↔ callers (`buildMcpSandbox`)
- **Firma:**

```typescript
interface McpClientConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  toolCallTimeoutMs?: number;   // default: 30000
  connectTimeoutMs?: number;    // default: 10000 — times out the handshake + listTools
}
```

> **[OBSERVED]** Both `connect()` (handshake + `listTools`) and `callTool()` are guarded by independent timeouts. `_connected` is set to `true` only after `listTools()` completes successfully — a failed `listTools` leaves the client disconnected with an empty tools list.

---

### `EmbeddingProvider`
- **Ubicación:** `packages/core/src/matchers/tier3/embeddings.ts`
- **Define el contrato entre:** Tier 3 semantic matchers ↔ embedding API implementation
- **Firma:**

```typescript
interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly model: string;
  readonly dimensions: number;
}
```

> **[OBSERVED]** Only one bundled implementation exists: `OpenAIEmbeddingProvider`, which accepts optional `model` and `dimensions` constructor params to select specific embedding models without subclassing. The interface is injectable via matcher options (`SemanticSimilarityOptions.provider`, etc.) — custom providers can be passed. No plugin registration mechanism in CLI.

---

## Complete type listing

<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

> Índice de tipos exportados — para ver la firma completa, leer el archivo fuente.

| Tipo | Categoría | Archivo |
|------|-----------|--------|
| `AuditFinding` | interface | `packages/core/src/audit/types.ts` |
| `AuditInput` | interface | `packages/core/src/audit/types.ts` |
| `AuditReport` | interface | `packages/core/src/audit/types.ts` |
| `AuditRule` | interface | `packages/core/src/audit/types.ts` |
| `AuditSeverity` | type alias | `packages/core/src/audit/types.ts` |
| `CacheEntry` | interface | `packages/core/src/cache/cache-store.ts` |
| `CacheSummary` | interface | `packages/core/src/cache/cache-store.ts` |
| `RunManifest` | interface | `packages/core/src/cache/run-manifest.ts` |
| `InferredAssertion` | interface | `packages/core/src/capture/analyzer.ts` |
| `TraceAnalysis` | interface | `packages/core/src/capture/analyzer.ts` |
| `GenerateOptions` | interface | `packages/core/src/capture/generator.ts` |
| `ArgDiff` | interface | `packages/core/src/cassette/diff.ts` |
| `DiffPolicy` | interface | `packages/core/src/cassette/diff.ts` |
| `DiffResult` | interface | `packages/core/src/cassette/diff.ts` |
| `DiffSeverity` | type alias | `packages/core/src/cassette/diff.ts` |
| `DiffToolCall` | interface | `packages/core/src/cassette/diff.ts` |
| `Cassette` | interface | `packages/core/src/cassette/types.ts` |
| `CassetteMetadata` | interface | `packages/core/src/cassette/types.ts` |
| `CassetteResult` | interface | `packages/core/src/cassette/types.ts` |
| `CassetteStub` | interface | `packages/core/src/cassette/types.ts` |
| `CassetteToolCall` | interface | `packages/core/src/cassette/types.ts` |
| `CacheConfig` | interface | `packages/core/src/config/types.ts` |
| `ModelRoles` | interface | `packages/core/src/config/types.ts` |
| `ProviderConfig` | interface | `packages/core/src/config/types.ts` |
| `RedactionConfig` | interface | `packages/core/src/config/types.ts` |
| `RedactionRule` | interface | `packages/core/src/config/types.ts` |
| `RetryConfig` | interface | `packages/core/src/config/types.ts` |
| `TracepactConfig` | interface | `packages/core/src/config/types.ts` |
| `TokenEntry` | interface | `packages/core/src/cost/accumulator.ts` |
| `TokenReport` | interface | `packages/core/src/cost/accumulator.ts` |
| `ExecutePromptOptions` | interface | `packages/core/src/driver/execute.ts` |
| `ProviderPreset` | interface | `packages/core/src/driver/presets.ts` |
| `AgentDriver` | interface | `packages/core/src/driver/types.ts` |
| `ContentBlock` | type alias | `packages/core/src/driver/types.ts` |
| `DriverCapabilities` | interface | `packages/core/src/driver/types.ts` |
| `HealthCheckResult` | interface | `packages/core/src/driver/types.ts` |
| `Message` | interface | `packages/core/src/driver/types.ts` |
| `RunConfig` | interface | `packages/core/src/driver/types.ts` |
| `RunInput` | interface | `packages/core/src/driver/types.ts` |
| `RunResult` | interface | `packages/core/src/driver/types.ts` |
| `UsageInfo` | interface | `packages/core/src/driver/types.ts` |
| `FlakeEntry` | interface | `packages/core/src/flake/store.ts` |
| `FlakeScore` | interface | `packages/core/src/flake/store.ts` |
| `LogLevel` | type alias | `packages/core/src/logger.ts` |
| `ArgMismatch` | interface | `packages/core/src/matchers/arg-matcher.ts` |
| `TraceCondition` | type alias | `packages/core/src/matchers/conditions.ts` |
| `McpCallSpec` | interface | `packages/core/src/matchers/mcp/index.ts` |
| `GroundingOptions` | interface | `packages/core/src/matchers/rag/semantic.ts` |
| `HallucinationOptions` | interface | `packages/core/src/matchers/rag/semantic.ts` |
| `RetrievalScoreOptions` | interface | `packages/core/src/matchers/rag/semantic.ts` |
| `JsonSchemaSpec` | interface | `packages/core/src/matchers/tier1/index.ts` |
| `LineCountSpec` | interface | `packages/core/src/matchers/tier1/index.ts` |
| `MarkdownSpec` | interface | `packages/core/src/matchers/tier1/index.ts` |
| `EmbeddingProvider` | interface | `packages/core/src/matchers/tier3/embeddings.ts` |
| `SemanticOverlapOptions` | interface | `packages/core/src/matchers/tier3/index.ts` |
| `SemanticSimilarityOptions` | interface | `packages/core/src/matchers/tier3/index.ts` |
| `CalibrationExample` | interface | `packages/core/src/matchers/tier4/calibration.ts` |
| `CalibrationSet` | interface | `packages/core/src/matchers/tier4/calibration.ts` |
| `ToPassJudgeOptions` | interface | `packages/core/src/matchers/tier4/index.ts` |
| `JudgeConfig` | interface | `packages/core/src/matchers/tier4/judge.ts` |
| `JudgeResult` | interface | `packages/core/src/matchers/tier4/judge.ts` |
| `JudgeVote` | interface | `packages/core/src/matchers/tier4/judge.ts` |
| `TrajectoryConfig` | interface | `packages/core/src/matchers/tier4/trajectory.ts` |
| `TrajectoryResult` | interface | `packages/core/src/matchers/tier4/trajectory.ts` |
| `MatcherContext` | interface | `packages/core/src/matchers/types.ts` |
| `MatcherResult` | interface | `packages/core/src/matchers/types.ts` |
| `MarkdownStructure` | interface | `packages/core/src/matchers/utils/markdown-tokenizer.ts` |
| `ConditionalResult` | interface | `packages/core/src/matchers/when.ts` |
| `McpClientConfig` | interface | `packages/core/src/mcp/client.ts` |
| `McpToolInfo` | interface | `packages/core/src/mcp/client.ts` |
| `McpConnection` | interface | `packages/core/src/mcp/connect.ts` |
| `EmbeddingModelInfo` | interface | `packages/core/src/models/types.ts` |
| `ModelInfo` | interface | `packages/core/src/models/types.ts` |
| `ModelRole` | type alias | `packages/core/src/models/types.ts` |
| `ProviderInfo` | interface | `packages/core/src/models/types.ts` |
| `ParsedSkill` | interface | `packages/core/src/parser/types.ts` |
| `SkillFrontmatter` | interface | `packages/core/src/parser/types.ts` |
| `RedactionConfig` | interface | `packages/core/src/redaction/types.ts` |
| `RedactionRule` | interface | `packages/core/src/redaction/types.ts` |
| `ContainerConfig` | interface | `packages/core/src/sandbox/container/types.ts` |
| `ContainerToolResult` | interface | `packages/core/src/sandbox/container/types.ts` |
| `McpMockConfig` | interface | `packages/core/src/sandbox/mcp/mcp-mock-server.ts` |
| `McpToolHandler` | type alias | `packages/core/src/sandbox/mcp/mcp-mock-server.ts` |
| `MockSandboxOptions` | interface | `packages/core/src/sandbox/mock-sandbox.ts` |
| `ProcessSandboxConfig` | interface | `packages/core/src/sandbox/process/types.ts` |
| `MockBashResult` | interface | `packages/core/src/sandbox/types.ts` |
| `MockToolDefs` | type alias | `packages/core/src/sandbox/types.ts` |
| `MockToolEntry` | interface | `packages/core/src/sandbox/types.ts` |
| `MockToolImpl` | type alias | `packages/core/src/sandbox/types.ts` |
| `Sandbox` | interface | `packages/core/src/sandbox/types.ts` |
| `WriteCapture` | interface | `packages/core/src/sandbox/types.ts` |
| `Scenario` | interface | `packages/core/src/scenarios/loader.ts` |
| `ScenarioParser` | interface | `packages/core/src/scenarios/loader.ts` |
| `JsonSchema` | interface | `packages/core/src/tools/types.ts` |
| `ToolDefs` | type alias | `packages/core/src/tools/types.ts` |
| `TypedToolDefinition` | interface | `packages/core/src/tools/types.ts` |
| `ToolCall` | interface | `packages/core/src/trace/types.ts` |
| `ToolCallSource` | type alias | `packages/core/src/trace/types.ts` |
| `ToolResult` | type alias | `packages/core/src/trace/types.ts` |
| `ToolTrace` | interface | `packages/core/src/trace/types.ts` |
| `PromptfooAssertionResult` | interface | `packages/promptfoo/src/assertions.ts` |
| `ToolMockConfig` | interface | `packages/promptfoo/src/provider.ts` |
| `TracepactProviderConfig` | interface | `packages/promptfoo/src/provider.ts` |
| `CustomMatchers` | interface | `packages/vitest/src/augment.d.ts` |
| `RunSkillOptions` | interface | `packages/vitest/src/run-skill.ts` |
<!-- END:GENERATED -->
