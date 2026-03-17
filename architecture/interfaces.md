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

> **[OBSERVED]** Only one bundled implementation exists: `OpenAIEmbeddingProvider`. The interface is injectable via matcher options (`SemanticSimilarityOptions.provider`, etc.) — custom providers can be passed. No plugin registration mechanism in CLI.
