<p align="center">
  <h1 align="center">TracePact</h1>
  <p align="center">Behavioral testing framework for AI agents</p>
  <p align="center">
    <a href="https://www.npmjs.com/package/@tracepact/core"><img src="https://img.shields.io/npm/v/@tracepact/core.svg" alt="npm version" /></a>
    <a href="https://github.com/dcdeve/tracepact/actions"><img src="https://img.shields.io/github/actions/workflow/status/dcdeve/tracepact/release.yml?branch=main" alt="CI" /></a>
    <a href="https://github.com/dcdeve/tracepact/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@tracepact/core.svg" alt="license" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@tracepact/core.svg" alt="node version" /></a>
  </p>
</p>

---

**Typed tool-trace assertions, mock sandboxes, record & replay, and CI-ready test suites for AI agents.**

TracePact verifies that your AI agent calls the right tools, in the right order, with the right arguments — and that its output makes sense. Works with any LLM provider. Runs offline (mock mode), live against real APIs, or from recorded cassettes.

## Why TracePact?

Testing AI agents is hard. Their behavior is non-deterministic, they use tools with side effects, and failures are subtle. TracePact solves this with a layered approach:

| Layer | What it tests | Cost | Deterministic |
|-------|--------------|------|---------------|
| **L0 — Audit** | Static analysis of tool definitions and prompts | Free | Yes |
| **L1 — Behavioral** | Tool calls, arguments, order, output structure | Free (mock) or tokens (live) | Yes (mock) |
| **L2 — Sandbox** | Real tool execution in Docker isolation | Free + compute | Yes |
| **L3 — Semantic** | Embedding similarity, LLM-as-judge | ~50 tokens/assertion | No |

Most tests live in L0-L1 (free and fast). Use L2-L3 for high-stakes validations.

## Quick Start

```bash
npm install @tracepact/core @tracepact/vitest

# Interactive setup — picks provider, models, generates config
npx tracepact init

# Or scaffold a quick demo
npx tracepact init --demo

# Run tests
npx tracepact
```

The interactive wizard guides you through provider selection, agent/judge/embedding model selection, and generates typed configuration files. Non-interactive flags (`--demo`, `--skill`, `--pattern`) are also available.

## Example

```typescript
import { describe, expect, test } from 'vitest';
import {
  createMockTools,
  mockReadFile,
  captureWrites,
  denyAll,
  TraceBuilder,
} from '@tracepact/vitest';

// Define mock tools — no API keys needed
const sandbox = createMockTools({
  read_file: mockReadFile({ 'src/app.ts': 'const x = 1;' }),
  write_file: captureWrites(),
  bash: denyAll(),
});

describe('code review agent', () => {
  test('reads source files before writing review', async () => {
    // Simulate the agent's tool calls
    const trace = new TraceBuilder()
      .addCall('read_file', { path: 'src/app.ts' }, 'const x = 1;')
      .addCall('write_file', { path: 'review.md', content: '# Review\n...' })
      .build();

    // Assert tool behavior
    expect(trace).toHaveCalledTool('read_file', { path: 'src/app.ts' });
    expect(trace).toNotHaveCalledTool('bash');
    expect(trace).toHaveCalledToolsInOrder(['read_file', 'write_file']);
    expect(trace).toHaveFileWritten('review.md', /# Review/);
  });

  test('output has correct structure', () => {
    const output = '# Review\n\nLooks good.\n\n```ts\nconst x = 1;\n```';

    expect(output).toHaveMarkdownStructure({
      headings: [{ level: 1 }],
      codeBlocks: { min: 1 },
    });
    expect(output).toContain('Review');
    expect(output).toNotContain('API_KEY');
  });
});
```

## Matchers

TracePact provides **30+ custom matchers** across 5 tiers, registered automatically via the Vitest plugin.

### Tier 0 — Tool Call Assertions (free, deterministic)

```typescript
expect(trace).toHaveCalledTool('read_file', { path: 'config.json' });
expect(trace).toNotHaveCalledTool('bash');
expect(trace).toHaveCalledToolsInOrder(['read_file', 'write_file']);
expect(trace).toHaveCalledToolsInStrictOrder(['read_file', 'write_file']);
expect(trace).toHaveToolCallCount('read_file', 3);
expect(trace).toHaveFirstCalledTool('read_file');
expect(trace).toHaveLastCalledTool('write_file');
```

### Tier 1 — Structural Assertions (free, deterministic)

```typescript
expect(output).toHaveMarkdownStructure({
  headings: [{ level: 1 }],
  codeBlocks: { min: 1 },
});
expect(output).toMatchJsonSchema(zodSchema);
expect(output).toHaveLineCount({ min: 5, max: 50 });
expect(trace).toHaveFileWritten('output.ts', /export/);
```

### Tier 2 — Content Assertions (free, deterministic)

```typescript
expect(output).toContain('SQL injection');
expect(output).toNotContain('API_KEY');
expect(output).toMention('vulnerability', { stem: true }); // matches "vulnerable", "vulnerabilities"
expect(output).toContainAll(['analysis', 'recommendation']);
expect(output).toContainAny(['bug', 'issue', 'problem']);
```

### Tier 3 — Semantic Assertions (embedding-based, ~50 tokens/call)

```typescript
expect(output).toBeSemanticallySimilar(
  'The code has a SQL injection vulnerability.',
  { provider: embeddingProvider, threshold: 0.80 }
);

expect(output).toHaveSemanticOverlap(
  ['SQL injection', 'input sanitization', 'parameterized queries'],
  { provider: embeddingProvider, threshold: 0.75, minTopics: 2 }
);
```

### Tier 4 — LLM-as-Judge (~150–450 tokens/call)

```typescript
expect(output).toPassJudge('Identifies the SQL injection vulnerability and suggests parameterized queries', {
  driver,
  calibration: 'code-review',
});
```

### RAG Matchers

```typescript
expect(trace).toHaveRetrievedDocument('search', { id: 'doc-123' });
expect(trace).toHaveRetrievedTopResult('search', { title: /security/ });
expect(output).toHaveGroundedResponseIn(documents, { provider });
expect(output).toNotHaveHallucinated(documents, { provider });
```

### MCP Matchers

```typescript
expect(trace).toHaveCalledMcpTool('database', 'query', { sql: 'SELECT 1' });
expect(trace).toHaveCalledMcpServer('database');
expect(trace).toHaveCalledMcpToolsInOrder([
  { server: 'database', tool: 'query' },
  { server: 'cache', tool: 'set' },
]);
```

### Conditional Matchers

```typescript
when(calledTool('write_file'))
  .expect(trace).toHaveCalledTool('read_file');

when(calledToolTimes('bash', 0))
  .expect(output).toContain('no shell access');
```

## Mock Sandbox

Test without API calls using mock tool implementations:

```typescript
import { createMockTools, mockReadFile, mockBash, captureWrites, denyAll, passthrough } from '@tracepact/vitest';

const sandbox = createMockTools({
  read_file: mockReadFile({
    'src/app.ts': 'export function main() {}',
    'src/**/*.test.ts': '// test file',  // glob patterns supported
  }),
  write_file: captureWrites(),
  bash: mockBash({ 'npm test': { stdout: 'PASS', exitCode: 0 } }),
  dangerous_tool: denyAll(),
  safe_tool: passthrough(),
});

const result = await sandbox.executeTool('read_file', { path: 'src/app.ts' });
// { type: 'success', output: 'export function main() {}' }
```

## Record & Replay (Cassettes)

Record live runs once, replay them deterministically in CI:

```typescript
import { runSkill } from '@tracepact/vitest';

// Record a cassette from a live run
const result = await runSkill(skill, {
  mode: 'live',
  record: './cassettes/deploy.json',
  driver,
});

// Replay without API calls
const replayed = await runSkill(skill, {
  mode: 'replay',
  cassette: './cassettes/deploy.json',
});

expect(replayed.trace).toHaveCalledTool('deploy', { env: 'staging' });
```

## Static Audit (No API Key Required)

Run 4 built-in rules without any LLM calls:

```bash
npx tracepact audit
```

```typescript
import { AuditEngine, BUILTIN_RULES } from '@tracepact/core';

const engine = new AuditEngine(BUILTIN_RULES);
const report = engine.auditSkill(parsedSkill);

// Rules: toolComboRisk, promptHygiene, skillCompleteness, noOpaqueTools
console.log(report.findings); // [{ rule: 'tool-combo-risk', severity: 'critical', message: '...' }]
```

## Sandboxes (Layer 2)

### Container Sandbox (Docker/Podman)

Run real tools in isolated Docker containers:

```typescript
import { createContainerTools } from '@tracepact/core';

const sandbox = await createContainerTools({
  image: 'node:22-slim',
  tools: ['bash', 'read_file', 'write_file'],
  timeout: 30_000,
});

const result = await sandbox.executeTool('bash', { command: 'npm test' });
// Runs in an isolated container — safe even with untrusted input
```

### Process Sandbox (No Docker Required)

Lightweight alternative using subprocess isolation — works in CI without Docker:

```typescript
import { createProcessTools } from '@tracepact/core';

const sandbox = createProcessTools({
  timeout: 30_000,
  allow: {
    fs: ['src/**', 'test/**'],
    bash: [/^npm /, /^node /],
  },
});

const result = await sandbox.executeTool('bash', { command: 'npm test' });
// Runs in an isolated tmpdir with restricted env — no Docker needed

sandbox.destroy(); // Cleans up tmpdir
```

The `ProcessSandbox` uses a temporary directory, clean environment variables, and path traversal protection. Use it when Docker isn't available (GitHub Actions without Docker, Vercel, serverless). The `doctor` command auto-detects which sandbox runtime is available.

## CLI

```bash
npx tracepact                         # Run all tests (default)
npx tracepact --live                  # Run against real LLM APIs
npx tracepact --provider openai       # Choose provider
npx tracepact --budget 50000          # Abort if live tokens exceed 50,000
npx tracepact --json                  # JSON output for CI
npx tracepact --no-cache              # Skip cache
npx tracepact --record                # Record cassettes (implies --live)
npx tracepact --replay ./cassettes    # Replay from cassettes
npx tracepact --full                  # Include expensive tests (Tier 3-4)

npx tracepact init                               # Interactive setup wizard
npx tracepact init --demo                        # Scaffold demo test suite
npx tracepact init --skill ./SKILL.md            # Generate from skill file
npx tracepact init --pattern api-client          # API client agent template
npx tracepact init --pattern data-transformer    # Data transformer template
npx tracepact models                             # Browse available models
npx tracepact models anthropic --verbose         # Show pricing for a provider
npx tracepact models --refresh                   # Update from models.dev
npx tracepact audit                              # Static analysis (no API key)
npx tracepact capture                 # Auto-generate tests from behavior
npx tracepact cache list|clear|verify # Manage response cache
npx tracepact cost-report             # Cost breakdown from last run
npx tracepact doctor                  # Environment health check
```

## Multi-Provider Support

Native drivers for OpenAI and Anthropic, plus any OpenAI-compatible API. Use the `model` shorthand or the full `providers` block:

```typescript
import { defineConfig } from '@tracepact/core';

// Simple: model shorthand (auto-expands to providers config)
export default defineConfig({
  model: 'anthropic/claude-sonnet-4-5-20250929',
  roles: {
    judge: 'anthropic/claude-haiku-4-5-20251001',     // cheap model for assertions
    embedding: 'openai/text-embedding-3-small',        // for semantic assertions
  },
});

// Advanced: explicit multi-provider config
export default defineConfig({
  providers: {
    default: 'openai',
    openai:     { model: 'gpt-4o' },
    anthropic:  { model: 'claude-sonnet-4-5-20250929' },
    groq:       { model: 'llama-3.3-70b-versatile' },
    deepseek:   { model: 'deepseek-chat' },
    mistral:    { model: 'mistral-large-latest' },
    together:   { model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    openrouter: { model: 'anthropic/claude-sonnet-4-20250514' },
  },
  cache: { enabled: true, ttlSeconds: 86400 },
  redaction: { redactEnvValues: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'] },
});
```

Browse available models with `tracepact models` — fetches the latest catalog from [models.dev](https://models.dev).

API keys are read from standard environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, etc.).

Both OpenAI and Anthropic drivers support **streaming** for reduced time-to-first-token:

```typescript
const result = await driver.run({
  skill,
  prompt: 'Review this code',
  sandbox,
  config: {
    stream: true,
    onChunk: (chunk) => process.stdout.write(chunk),
  },
});
```

## Packages

| Package | Description |
|---------|-------------|
| [`@tracepact/core`](./packages/core) | Matchers, trace model, mock/container/process sandboxes, audit engine, OpenAI + Anthropic drivers, cache, redaction |
| [`@tracepact/vitest`](./packages/vitest) | Vitest plugin, matcher registration, `runSkill()`, `test.live()`, `test.expensive()` |
| [`@tracepact/cli`](./packages/cli) | CLI with `run`, `init`, `models`, `audit`, `capture`, `cache`, `cost-report`, `doctor` commands |
| [`@tracepact/promptfoo`](./packages/promptfoo) | Promptfoo integration — tool-trace assertions in eval configs |
| [`@tracepact/mcp-server`](./packages/mcp-server) | MCP server for IDE integration (Cursor, Claude Code, Windsurf) |

## Architecture

```
packages/
  core/src/
    config/        defineConfig, typed options
    parser/        SKILL.md parser, YAML frontmatter
    matchers/
      tier0/       Tool call assertions (7)
      tier1/       Structural assertions (4)
      tier2/       Content assertions (5)
      tier3/       Semantic assertions (2) — embedding-based
      tier4/       Judge assertions — LLM-as-judge
      rag/         RAG-specific matchers (5+)
      mcp/         MCP tool call matchers (4)
      utils/       Markdown tokenizer, JSON extractor, Porter stemmer
    sandbox/       MockSandbox, ContainerSandbox, ProcessSandbox, MCP mock
    cache/         CacheStore with TTL, checksums, manifest
    driver/        OpenAIDriver, AnthropicDriver, DriverRegistry, RetryPolicy, Semaphore
    models/        Model catalog (models.dev), snapshot, embeddings, registry
    redaction/     RedactionPipeline, PII/secret rules
    trace/         TraceBuilder, ToolTrace types
    audit/         AuditEngine, 4 built-in rules
    capture/       Test auto-generation from traces
    cassette/      Record & replay
    cost/          TokenAccumulator
    flake/         Flake detection & scoring

  vitest/src/      Plugin, matcher adapter, runSkill, test.live
  cli/src/         Commands: run, init, models, audit, capture, cache, cost-report, doctor
  mcp-server/src/  8 MCP tools for IDE integration
  promptfoo/src/   Provider + assertion functions for Promptfoo
```

## Documentation

- [Quick Start](./docs/guide/quick-start.md)
- [Mock vs Live Testing](./docs/guide/mock-vs-live.md)
- [CI Integration](./docs/guide/ci-integration.md)
- [IDE Setup (MCP)](./docs/guide/ide-setup.md)
- [Assertion Reference](./docs/reference/assertions.md)
- [Configuration Reference](./docs/reference/configuration.md)
- [CLI Reference](./docs/reference/cli.md)
- [Semantic Assertions](./docs/advanced/semantic-assertions.md)
- [Judge Assertions](./docs/advanced/judge-assertions.md)
- [Cassettes (Record & Replay)](./docs/advanced/cassettes.md)
- [Flake Scoring](./docs/advanced/flake-scoring.md)
- [Promptfoo Integration](./docs/promptfoo-integration.md)

## Roadmap

See [TODO.md](./TODO.md) for current work-in-progress and planned improvements.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, coding standards, and how to submit changes.

## License

[MIT](./LICENSE) &copy; [dcdeve](https://github.com/dcdeve)
