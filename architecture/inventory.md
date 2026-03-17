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

---

## Complete file listing

<!-- BEGIN:GENERATED -->
_Auto-generated from code — do not edit this block manually._

> Auto-generated list of all source files

| Path | Lines | Exports | Top export |
|------|-------|---------|------------|
| `packages/core/src/driver/openai-driver.ts` | 475 | 1 | `OpenAIDriver` |
| `packages/cli/src/commands/init.ts` | 437 | 1 | `init` |
| `packages/core/src/driver/anthropic-driver.ts` | 395 | 1 | `AnthropicDriver` |
| `packages/core/src/matchers/rag/semantic.ts` | 298 | 6 | `toHaveGroundedResponseIn` |
| `packages/core/src/matchers/tier1/index.ts` | 285 | 7 | `toHaveMarkdownStructure` |
| `packages/core/src/matchers/tier0/index.ts` | 276 | 7 | `toHaveCalledTool` |
| `packages/core/src/models/registry.ts` | 257 | 9 | `refreshModels` |
| `packages/core/src/index.ts` | 255 | 220 | `defineConfig` |
| `packages/core/src/cache/cache-store.ts` | 244 | 3 | `CacheEntry` |
| `packages/core/src/matchers/tier4/judge.ts` | 242 | 5 | `buildJudgePrompt` |
| `packages/core/src/sandbox/mock-sandbox.ts` | 236 | 2 | `MockSandboxOptions` |
| `packages/core/src/matchers/rag/index.ts` | 235 | 5 | `toHaveRetrievedDocument` |
| `packages/core/src/driver/execute.ts` | 228 | 3 | `clearRegistryCache` |
| `packages/core/src/audit/rules.ts` | 205 | 5 | `toolComboRisk` |
| `packages/vitest/src/run-skill.ts` | 204 | 3 | `_closePendingMcpConnections` |
| `packages/vitest/src/matchers.ts` | 198 | 1 | `tracepactMatchers` |
| `packages/core/src/matchers/tier4/trajectory.ts` | 196 | 4 | `buildTraceSummary` |
| `packages/cli/src/patterns/templates.ts` | 191 | 9 | `PACKAGE_JSON_TEMPLATE` |
| `packages/core/src/models/snapshot.ts` | 189 | 1 | `SNAPSHOT_PROVIDERS` |
| `packages/core/src/cassette/player.ts` | 178 | 1 | `CassettePlayer` |
| `packages/core/src/matchers/mcp/index.ts` | 178 | 5 | `toHaveCalledMcpTool` |
| `packages/core/src/driver/registry.ts` | 176 | 2 | `_setRegistryCacheChecker` |
| `packages/core/src/sandbox/container/container-sandbox.ts` | 172 | 1 | `ContainerSandbox` |
| `packages/core/src/matchers/tier2/index.ts` | 168 | 5 | `toContain` |
| `packages/core/src/sandbox/process/process-sandbox.ts` | 161 | 1 | `ProcessSandbox` |
| `packages/promptfoo/src/provider.ts` | 149 | 3 | `ToolMockConfig` |
| `packages/cli/src/commands/capture.ts` | 147 | 1 | `capture` |
| `packages/core/src/mcp/client.ts` | 146 | 3 | `McpClientConfig` |
| `packages/mcp-server/src/index.ts` | 143 | 0 | `—` |
| `packages/core/src/redaction/pipeline.ts` | 141 | 1 | `RedactionPipeline` |
| `packages/core/src/cassette/diff.ts` | 140 | 6 | `diffCassettes` |
| `packages/core/src/sandbox/container/docker-client.ts` | 135 | 2 | `detectRuntime` |
| `packages/core/src/matchers/tier3/index.ts` | 132 | 10 | `toBeSemanticallySimilar` |
| `packages/core/src/matchers/tier4/calibration.ts` | 132 | 5 | `loadBundledCalibration` |
| `packages/cli/src/index.ts` | 122 | 1 | `createProgram` |
| `packages/cli/src/commands/diff.ts` | 121 | 1 | `diff` |
| `packages/core/src/capture/analyzer.ts` | 113 | 3 | `analyzeTrace` |
| `packages/core/src/matchers/index.ts` | 113 | 72 | `MatcherResult` |
| `packages/core/src/flake/store.ts` | 108 | 3 | `FlakeEntry` |
| `packages/core/src/tools/define-tools.ts` | 107 | 1 | `defineTools` |
| `packages/promptfoo/src/assertions.ts` | 106 | 7 | `assertCalledTool` |
| `packages/cli/src/commands/doctor.ts` | 105 | 1 | `doctor` |
| `packages/core/src/matchers/arg-matcher.ts` | 104 | 3 | `matchArgs` |
| `packages/core/src/matchers/tier3/embedding-cache.ts` | 103 | 4 | `embedWithCache` |
| `packages/core/src/capture/generator.ts` | 98 | 2 | `generateTestFile` |
| `packages/core/src/sandbox/factories.ts` | 93 | 7 | `createMockTools` |
| `packages/core/src/driver/types.ts` | 92 | 9 | `DriverCapabilities` |
| `packages/core/src/driver/semaphore.ts` | 89 | 1 | `Semaphore` |
| `packages/cli/src/commands/audit.ts` | 88 | 1 | `audit` |
| `packages/core/src/matchers/tier4/index.ts` | 83 | 15 | `toPassJudge` |
| `packages/core/src/driver/retry-policy.ts` | 78 | 1 | `RetryPolicy` |
| `packages/core/src/cache/run-manifest.ts` | 77 | 3 | `computeManifest` |
| `packages/vitest/src/json-reporter.ts` | 75 | 1 | `TracepactJsonReporter` |
| `packages/mcp-server/src/tools/list-tests.ts` | 73 | 1 | `handleListTests` |
| `packages/core/src/cassette/recorder.ts` | 72 | 1 | `CassetteRecorder` |
| `packages/core/src/matchers/utils/markdown-tokenizer.ts` | 72 | 2 | `tokenizeMarkdown` |
| `packages/mcp-server/src/tools/capture.ts` | 70 | 1 | `handleCapture` |
| `packages/core/src/matchers/utils/json-extractor.ts` | 69 | 1 | `extractJson` |
| `packages/core/src/cost/accumulator.ts` | 68 | 3 | `TokenEntry` |
| `packages/core/src/parser/skill-parser.ts` | 68 | 1 | `parseSkill` |
| `packages/core/src/trace/trace-builder.ts` | 68 | 1 | `TraceBuilder` |
| `packages/vitest/src/setup.ts` | 67 | 0 | `—` |
| `packages/core/src/driver/resolve.ts` | 67 | 3 | `getDefaultModel` |
| `packages/core/src/scenarios/loader.ts` | 67 | 4 | `registerScenarioParser` |
| `packages/mcp-server/src/tools/schemas.ts` | 67 | 6 | `runSchema` |
| `packages/core/src/sandbox/mcp/mcp-mock-server.ts` | 67 | 4 | `createMcpMock` |
| `packages/cli/src/commands/run.ts` | 66 | 1 | `runTests` |
| `packages/cli/src/commands/models.ts` | 64 | 1 | `models` |
| `packages/cli/src/commands/cache.ts` | 63 | 1 | `cache` |
| `packages/core/src/audit/engine.ts` | 60 | 1 | `AuditEngine` |
| `packages/vitest/src/token-tracker.ts` | 58 | 3 | `trackUsage` |
| `packages/core/src/mcp/connect.ts` | 58 | 2 | `connectMcp` |
| `packages/core/src/config/types.ts` | 57 | 7 | `ModelRoles` |
| `packages/core/src/cassette/types.ts` | 55 | 5 | `Cassette` |
| `packages/core/src/config/define-config.ts` | 53 | 1 | `defineConfig` |
| `packages/core/src/parser/frontmatter-validator.ts` | 53 | 1 | `validateFrontmatter` |
| `packages/core/src/logger.ts` | 51 | 5 | `setLogLevel` |
| `packages/core/src/matchers/tier3/embeddings.ts` | 49 | 3 | `estimateEmbeddingTokens` |
| `packages/mcp-server/src/tools/run.ts` | 48 | 1 | `handleRun` |
| `packages/vitest/src/augment.d.ts` | 45 | 1 | `CustomMatchers` |
| `packages/vitest/src/index.ts` | 44 | 30 | `tracepactPlugin` |
| `packages/mcp-server/src/tools/audit.ts` | 44 | 1 | `handleAudit` |
| `packages/cli/src/commands/cost-report.ts` | 43 | 1 | `costReport` |
| `packages/core/src/sandbox/glob-utils.ts` | 39 | 3 | `globToRegex` |
| `packages/core/src/sandbox/types.ts` | 37 | 6 | `Sandbox` |
| `packages/core/src/audit/types.ts` | 36 | 5 | `AuditSeverity` |
| `packages/core/src/models/embeddings.ts` | 35 | 2 | `EMBEDDING_MODELS` |
| `packages/mcp-server/src/tools/replay.ts` | 33 | 1 | `handleReplay` |
| `packages/core/src/sandbox/container/types.ts` | 33 | 2 | `ContainerConfig` |
| `packages/core/src/models/types.ts` | 31 | 4 | `ModelInfo` |
| `packages/core/src/parser/types.ts` | 31 | 3 | `ParsedSkill` |
| `packages/vitest/src/plugin.ts` | 30 | 1 | `tracepactPlugin` |
| `packages/core/src/matchers/when.ts` | 30 | 2 | `when` |
| `packages/core/src/config/defaults.ts` | 25 | 7 | `DEFAULT_CACHE` |
| `packages/core/src/driver/presets.ts` | 25 | 3 | `ProviderPreset` |
| `packages/core/src/matchers/conditions.ts` | 25 | 5 | `calledTool` |
| `packages/core/src/trace/types.ts` | 24 | 4 | `ToolTrace` |
| `packages/core/src/matchers/types.ts` | 22 | 2 | `MatcherResult` |
| `packages/mcp-server/src/tools/diff.ts` | 21 | 1 | `handleDiff` |
| `packages/core/src/sandbox/index.ts` | 20 | 15 | `Sandbox` |
| `packages/core/src/matchers/tier3/cosine.ts` | 20 | 1 | `cosineSimilarity` |
| `packages/core/src/sandbox/process/types.ts` | 19 | 1 | `ProcessSandboxConfig` |
| `packages/vitest/src/annotations.ts` | 16 | 2 | `expensive` |
| `packages/promptfoo/src/index.ts` | 15 | 10 | `TracepactProvider` |
| `packages/core/src/errors/parse-error.ts` | 15 | 1 | `SkillParseError` |
| `packages/core/src/tools/types.ts` | 15 | 3 | `ToolDefs` |
| `packages/core/src/redaction/builtin-rules.ts` | 13 | 1 | `BUILTIN_RULES` |
| `packages/core/src/sandbox/container/index.ts` | 13 | 6 | `createContainerTools` |
| `packages/core/src/cassette/index.ts` | 12 | 11 | `Cassette` |
| `packages/core/src/errors/config-error.ts` | 12 | 1 | `ConfigError` |
| `packages/vitest/src/test-live.ts` | 10 | 1 | `live` |
| `packages/core/src/audit/index.ts` | 10 | 11 | `AuditEngine` |
| `packages/core/src/redaction/types.ts` | 10 | 2 | `RedactionRule` |
| `packages/core/src/sandbox/process/index.ts` | 10 | 3 | `createProcessTools` |
| `packages/core/src/errors/base.ts` | 9 | 1 | `TracepactError` |
| `packages/core/src/errors/driver-error.ts` | 9 | 1 | `DriverError` |
| `packages/core/src/matchers/utils/stemmer.ts` | 6 | 1 | `stem` |
| `packages/core/src/capture/index.ts` | 5 | 5 | `analyzeTrace` |
| `packages/core/src/driver/mock-driver.ts` | 4 | 0 | `—` |
| `packages/core/src/sandbox/mcp/index.ts` | 3 | 4 | `McpMockServer` |

**Total:** 120 files, 11748 lines
<!-- END:GENERATED -->
