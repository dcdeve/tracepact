# Changelog

## Unreleased

- **Model catalog (models.dev)** — Dynamic model catalog with 3-layer fallback: fetch from models.dev API → local cache (24h TTL) → static snapshot. Covers 11 providers (OpenAI, Anthropic, Groq, DeepSeek, Mistral, xAI, Together, OpenRouter, Cerebras, Fireworks, Perplexity).
- **`tracepact models` command** — Browse available models and providers. Shows API key status, context windows, tags. `--verbose` for pricing, `--refresh` to update from models.dev.
- **Interactive `tracepact init`** — Wizard powered by `@clack/prompts`. Guides through provider selection, agent/judge/embedding model selection, and generates typed config. Non-interactive flags (`--demo`, `--pattern`, `--skill`) still work.
- **`model` shorthand in config** — `model: 'anthropic/claude-sonnet-4-5-20250929'` auto-expands to full `providers` block.
- **Model roles** — `roles: { agent, judge, embedding }` in config for per-role model assignment.
- **Token-based tracking** — Replaced dollar-based pricing (`calculateCost`, `MODEL_PRICING`) with pure token tracking (`TokenAccumulator`). Budget limits are now in tokens, not USD.
- **CLI migrated to commander** — Auto-generated `--help`, typed options, proper validation. Passthrough to vitest via `--` separator. Rejects `--config` in passthrough to prevent silent clobber.
- **Capture executes prompts directly** — `tracepact capture --prompt` now sends the prompt to the LLM instead of delegating to vitest. Uses `executePrompt()` extracted to `@tracepact/core`.
- **Shared driver orchestration** — `executePrompt()`, `resolveConfig()`, `detectProvider()` extracted to `@tracepact/core` for reuse across CLI and vitest.
- **Porter2 stemmer** — Replaced manual Porter Stemmer (166 LOC) with `stemmer` npm package.
- **Bug fix: unknownTool** — `ProcessSandbox` now correctly marks unknown tools in traces.

## [0.3.0] - 2026-03-06

### Added
- **`tracepact audit`** — static analysis of SKILL.md without API calls (Layer 0)
  - 4 built-in rules: `tool-combo-risk`, `prompt-hygiene`, `skill-completeness`, `no-opaque-tools`
  - `--format json|summary`, `--fail-on <severity>` flags
  - Custom rules via `new AuditEngine([...rules])`
- **MCP Behavioral Testing** (Phase 2E)
  - `ToolCallSource` type on `ToolCall` — distinguishes `local` vs `mcp` tool calls
  - `McpMockServer` + `createMcpMock()` — in-process MCP server mock with programmatic handlers
  - 4 MCP matchers: `toHaveCalledMcpTool`, `toHaveCalledMcpServer`, `toNotHaveCalledMcpTool`, `toHaveCalledMcpToolsInOrder`
  - `ContainerSandbox` routes `mcp__<server>__<tool>` calls to MCP mocks
  - Cassette record/replay preserves `ToolCall.source`
- **Container Sandbox** (Phase 2C)
  - `ContainerSandbox` — Docker/Podman-isolated tool execution
  - `DockerClient` with injectable mock for testing
  - Filesystem and bash allowlists (glob patterns, regex)
  - `createContainerTools()` factory
  - `tracepact doctor` checks container runtime
- **RAG matchers** — retrieval-augmented generation assertions
  - Tier 0: `toHaveRetrievedDocument`, `toHaveRetrievedTopResult`, `toNotHaveRetrievedDocument`, `toHaveRetrievedNResults`, `toHaveCitedSources`
  - Tier 3: `toHaveGroundedResponseIn`, `toNotHaveHallucinated`, `toHaveRetrievalScore`
- **Trajectory matcher** — `toMatchTrajectory` with `calledTool`, `calledToolWith`, `calledToolAfter`, `calledToolTimes` conditions
- **Conditional matchers** — `when(trace, condition).then(matcher)` for conditional assertions
- **LLM-as-Judge** — `toPassJudge` with calibration sets, `JudgeExecutor`, `buildJudgePrompt`
- **Semantic assertions** — `toBeSemanticallySimilar`, `toHaveSemanticOverlap` with embedding providers
- **Cassette capture** — `tracepact capture` generates test files from recorded traces
- **`@tracepact/mcp-server`** — 8 MCP tools for IDE integration
- **Flake scoring** — `FlakeStore` tracks test stability across runs
- **Cost accumulator** — `CostAccumulator` for budget tracking across suites

### Changed
- 440 tests (up from 276 in v0.2.0)
- `CassettePlayer` tolerant to missing fields (messages, usage, totalCalls)
- `tracepact doctor` now checks container runtime availability

## [0.2.0] - 2026-03-06

### Added
- **OpenAI driver** — run tests against GPT-4o, GPT-4-turbo, and other OpenAI models
- **Generic multi-provider** — any OpenAI-compatible API via `baseURL` config
- **Provider presets** — built-in support for Groq, DeepSeek, Mistral, Together, OpenRouter
- **`--provider` flag** — select provider per run (`tracepact --provider openai`)
- **Cost tracking** — `calculateCost()`, `CostAccumulator`, per-model pricing
- **`--budget` flag** — abort suite when cost threshold exceeded
- **JSON reporter** — structured output for CI at `.tracepact/results.json`
- **Scenario files** — `loadScenarios()` for JSON/YAML test datasets
- **Promptfoo integration** — `@tracepact/promptfoo` adapter with `TracepactProvider` and 6 assertion functions
- **Health check** — provider connectivity verified before live test suites
- **Cross-provider cache** — cache entries include provider in manifest hash
- **Cross-provider example suite** — same tests run against Claude and OpenAI

### Changed
- `DriverRegistry` rewritten for generic provider resolution (any OpenAI-compatible endpoint)
- `tracepact doctor` checks all configured providers
- Improved error messages for missing API keys

## [0.1.0] - 2026-02-20

### Added
- **Core library** (`@tracepact/core`) — SKILL.md parser, 16 matchers (Tier 0-2), MockSandbox, tool factories, TraceBuilder, CacheStore, RedactionPipeline, RetryPolicy, Semaphore
- **Vitest integration** (`@tracepact/vitest`) — plugin, matcher adapter, `runSkill()`, `test.live()`
- **CLI** (`@tracepact/cli`) — `tracepact run`, `init --demo`, `cache list/clear/verify`, `doctor`
