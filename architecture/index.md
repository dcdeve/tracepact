# Architecture — Tracepact

> Marcadores: `[OBSERVED]` = visto en código, `[INFERRED]` = deducido, `[UNCLEAR]` = no determinado.
> Bloques `<!-- BEGIN:GENERATED -->` en cada archivo son auto-generados por `make arch` — no editar a mano.

## Executive Summary

Tracepact is a **testing framework for LLM-powered skills (AI agents)** — it lets developers define a "skill" (a system prompt + tool set), run it against a real or mocked AI provider, and assert on the resulting tool traces and outputs. The system is organized as a **TypeScript monorepo** with five packages: a core library, a CLI, a Vitest plugin, an MCP server, and a Promptfoo integration. Architecturally, the system follows a **layered adapter pattern**: a stable core domain (driver interface, matcher system, cassette I/O) surrounded by thin integration adapters (vitest plugin, CLI, MCP server). The codebase is well-structured and consistent; the main systemic risk is a **hard coupling between `@tracepact/vitest` and `@tracepact/core`** with no intermediate abstraction layer, and the **judge/semantic matcher subsystem** depends on live API calls with no fallback strategy.

## Mapa de navegación

| Documento | Qué encontrás ahí | Cuándo leerlo | Tipo |
|-----------|-------------------|---------------|------|
| [shape.md](./shape.md) | Estructura del repo, diagrama de dependencias | Entender la organización general | mixto |
| [entrypoints.md](./entrypoints.md) | Puntos de entrada del sistema | Saber dónde arranca la ejecución | mixto |
| [components-drivers.md](./components-drivers.md) | `AgentDriver`, `AnthropicDriver`, `OpenAIDriver`, `DriverRegistry`, `RetryPolicy`, `Semaphore` | Entender el subsistema de providers | mixto |
| [components-testing.md](./components-testing.md) | `MockSandbox`, `Matcher System` (Tier 0–4), `CassetteRecorder/Player`, `CacheStore` | Entender el core de testing | mixto |
| [components-tooling.md](./components-tooling.md) | `AuditEngine`, `McpClient`, `tracepactPlugin`, `RedactionPipeline` | Entender herramientas y adapters de integración | mixto |
| [interfaces.md](./interfaces.md) | Contratos entre módulos | Entender los boundaries | mixto |
| [flows.md](./flows.md) | Flujos de ejecución con diagramas | Seguir un request/comando end-to-end | conceptual |
| [dependencies.md](./dependencies.md) | Deps externas e internas | Evaluar footprint de dependencias | mixto |
| [wiring.md](./wiring.md) | DI, config, env vars, registries | Entender cómo se ensambla todo | conceptual |
| [cross-cutting.md](./cross-cutting.md) | Error handling, auth, logging, validación, token budget | Concerns transversales | conceptual |
| [tech-debt.md](./tech-debt.md) | Deuda técnica y riesgos | Priorizar mejoras | conceptual |
| [inventory.md](./inventory.md) | Lista completa de módulos secundarios | Buscar algo específico | mixto |
| [signatures.md](./signatures.md) | Firmas exportadas (funciones y clases) — 100% generado | Referencia rápida de API pública | referencia |
| [env-vars.md](./env-vars.md) | Variables de entorno — 100% generado | Ver qué env vars usa el sistema | referencia |
| [import-graph.md](./import-graph.md) | Grafo de imports entre paquetes — 100% generado | Analizar dependencias entre packages | referencia |

## Diagrama de alto nivel

```mermaid
graph TD
  CLI["@tracepact/cli"]
  VIT["@tracepact/vitest"]
  MCP["@tracepact/mcp-server"]
  PFO["@tracepact/promptfoo"]
  CORE["@tracepact/core"]

  CLI --> CORE
  VIT --> CORE
  MCP --> CORE
  PFO --> CORE

  subgraph CORE_INTERNALS["@tracepact/core internals"]
    DRV["driver/\n(AgentDriver, AnthropicDriver, OpenAIDriver)"]
    MATCH["matchers/\n(Tier 0–4, RAG, MCP)"]
    CASS["cassette/\n(record + replay)"]
    CACHE["cache/\n(CacheStore)"]
    SAND["sandbox/\n(MockSandbox)"]
    PARSE["parser/\n(parseSkill)"]
    TRACE["trace/\n(TraceBuilder)"]
    TOOLS["tools/\n(defineTools)"]
    AUDIT["audit/\n(AuditEngine)"]
    MCPCLI["mcp/\n(McpClient)"]
  end

  DRV --> TRACE
  DRV --> SAND
  MATCH --> TRACE
  CASS --> TRACE
  VIT --> DRV
  VIT --> MATCH
  VIT --> SAND
  VIT --> CASS
```

> El diagrama muestra los módulos principales de `@tracepact/core`. Módulos secundarios omitidos por claridad: `capture/`, `redaction/`, `config/`, `cost/`, `flake/`, `models/`, `scenarios/`, `errors/`, `calibration-sets/`. Ver [inventory.md](./inventory.md) para la lista completa.
