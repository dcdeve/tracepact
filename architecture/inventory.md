> **Sistema:** Tracepact — testing framework for LLM-powered skills (AI agents)
> **Este documento cubre:** Inventario de módulos secundarios no cubiertos en detalle en los otros documentos
> **Índice general:** [index.md](./index.md)

# Appendix: Module Inventory

| Path | Propósito (1 línea) | Clasificación |
|------|---------------------|---------------|
| `packages/core/src/scenarios/` | Load parameterized test scenarios from JSON/YAML | utility |
| `packages/core/src/flake/` | Persist pass/fail history to detect flaky tests | infrastructure |
| `packages/core/src/cost/` | Accumulate and report token usage across a test suite | utility |
| `packages/core/src/models/` | Registry of providers, models, and embedding model info | utility |
| `packages/core/src/redaction/` | Scrub secrets from strings and objects | cross-cutting |
| `packages/core/src/capture/` | Analyze a `ToolTrace` and generate a `.test.ts` scaffold | utility |
| `packages/vitest/src/plugin.ts` | `tracepactPlugin()` — Vitest plugin factory; registers includes pattern, test timeout, and setup files | adapter |
| `packages/vitest/src/run-skill.ts` | `runSkill()` — main public API entry point for executing skills in tests; handles live, replay, and mock-only modes | adapter |
| `packages/vitest/src/matchers.ts` | Re-exports core matchers and assembles `tracepactMatchers` object for `expect.extend()` | adapter |
| `packages/vitest/src/test-live.ts` | `live()` test wrapper (skips unless `TRACEPACT_LIVE=1`) | adapter |
| `packages/vitest/src/annotations.ts` | `expensive()`, `cheap()` test wrappers | adapter |
| `packages/vitest/src/json-reporter.ts` | Custom Vitest reporter that emits JSON run summary | adapter |
| `packages/vitest/src/token-tracker.ts` | Global token accumulator for Vitest test suite | adapter |
| `packages/vitest/src/setup.ts` | Installs custom matchers via `expect.extend()` | adapter |
| `packages/cli/src/commands/` | Individual command handler files for each CLI subcommand | adapter |
| `packages/promptfoo/src/provider.ts` | `TracepactProvider` — Promptfoo provider adapter, calls `driver.run()` directly | adapter |
| `packages/promptfoo/src/assertions.ts` | Promptfoo-compatible wrappers around core matchers | adapter |
