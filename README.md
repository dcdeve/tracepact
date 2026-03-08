# TracePact

**Test what your AI agent actually does — which tools it calls, in what order, with what arguments. No API keys required.**

[![npm version](https://img.shields.io/npm/v/@tracepact/core.svg)](https://www.npmjs.com/package/@tracepact/core)
[![CI](https://img.shields.io/github/actions/workflow/status/dcdeve/tracepact/ci.yml?branch=main)](https://github.com/dcdeve/tracepact/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/dcdeve/tracepact)](https://github.com/dcdeve/tracepact/blob/main/LICENSE)
[![node version](https://img.shields.io/node/v/@tracepact/core.svg)](https://nodejs.org)

---

You're building an agent. It calls tools. You have no idea if it calls the right ones, in the right order, with the right arguments — unless you run it live every time.

TracePact fixes that. Write tests for agent behavior the same way you'd write unit tests for functions. Run them offline. Catch regressions before they hit production.

Works with any LLM provider. Integrates with Vitest, Claude Code, Cursor, and Windsurf via MCP.

---

## Quick example

```ts
import { describe, expect, test } from 'vitest';
import { TraceBuilder } from '@tracepact/vitest';

describe('code review agent', () => {
  test('reads source before writing review', () => {
    const trace = new TraceBuilder()
      .addCall('read_file', { path: 'src/app.ts' }, 'const x = 1;')
      .addCall('write_file', { path: 'review.md', content: '# Review\n...' })
      .build();

    expect(trace).toHaveCalledToolsInOrder(['read_file', 'write_file']);
    expect(trace).toNotHaveCalledTool('bash');
    expect(trace).toHaveFileWritten('review.md', /# Review/);
  });
});
```

No API calls. No tokens. Deterministic.

---

## Install

```
npm install @tracepact/core @tracepact/vitest @tracepact/cli

npx tracepact init          # interactive setup
npx tracepact init --demo   # scaffold a demo test suite
npx tracepact               # run all tests
```

---

## Testing agents that use MCP

If your agent calls MCP servers (filesystem, database, memory, etc.), TracePact can assert exactly which tools were invoked and with what arguments.

```ts
// Assert MCP tool calls
expect(trace).toHaveCalledMcpTool('database', 'query', { sql: 'SELECT 1' });
expect(trace).toHaveCalledMcpServer('database');
expect(trace).toHaveCalledMcpToolsInOrder([
  { server: 'database', tool: 'query' },
  { server: 'cache',    tool: 'set' },
]);
```

The MCP sandbox lets you mock entire MCP servers so tests run without a real server:

```ts
import { createMcpMock } from '@tracepact/core';

const db = createMcpMock({
  server: 'database',
  tools: {
    query: ({ sql }) => ({ type: 'success', content: JSON.stringify({ rows: [{ id: 1 }] }) }),
  },
});
```

---

## Layers of testing

| Layer | What it tests | Needs API? | Deterministic |
| --- | --- | --- | --- |
| **L0 — Audit** | Static analysis of tool definitions and prompts | No | Yes |
| **L1 — Behavioral** | Tool calls, arguments, order, output structure | No (mock) | Yes |
| **L2 — Sandbox** | Real tool execution in Docker or subprocess isolation | No | Yes |
| **L3 — Semantic** | Embedding similarity, hallucination detection, RAG grounding | Yes (~50 tokens) | No |
| **L4 — Judge** | LLM-as-judge assertions | Yes (~300 tokens) | No |

Start at L0–L1. They're free, fast, and catch most regressions. Add L2–L4 for high-stakes paths.

---

## Matchers

### Tool call assertions (L1 — free)

```ts
expect(trace).toHaveCalledTool('read_file', { path: 'config.json' });
expect(trace).toNotHaveCalledTool('bash');
expect(trace).toHaveCalledToolsInOrder(['read_file', 'write_file']);
expect(trace).toHaveCalledToolsInStrictOrder(['read_file', 'write_file']);
expect(trace).toHaveToolCallCount('read_file', 3);
expect(trace).toHaveFirstCalledTool('read_file');
expect(trace).toHaveLastCalledTool('write_file');
```

### Structural assertions (L1 — free)

```ts
expect(output).toHaveMarkdownStructure({ headings: [{ level: 1 }], codeBlocks: { min: 1 } });
expect(output).toMatchJsonSchema(zodSchema);
expect(output).toHaveLineCount({ min: 5, max: 50 });
expect(trace).toHaveFileWritten('output.ts', /export/);
```

### Content assertions (L1 — free)

```ts
expect(output).toContain('SQL injection');
expect(output).toNotContain('API_KEY');
expect(output).toMention('vulnerability', { stem: true }); // matches "vulnerable", "vulnerabilities"
expect(output).toContainAll(['analysis', 'recommendation']);
expect(output).toContainAny(['bug', 'issue', 'problem']);
```

### Semantic assertions (L3 — ~50 tokens/call)

```ts
expect(output).toBeSemanticallySimilar(
  'The code has a SQL injection vulnerability.',
  { provider: embeddingProvider, threshold: 0.80 }
);
expect(output).toHaveSemanticOverlap(
  ['SQL injection', 'input sanitization', 'parameterized queries'],
  { provider: embeddingProvider, threshold: 0.75, minTopics: 2 }
);
```

### RAG assertions (L3)

```ts
expect(trace).toHaveRetrievedDocument('search', { id: 'doc-123' });
expect(trace).toHaveRetrievedTopResult('search', { title: /security/ });
expect(output).toHaveGroundedResponseIn(documents, { provider });
expect(output).toNotHaveHallucinated(documents, { provider });
```

### LLM-as-judge (L4 — ~300 tokens/call)

```ts
expect(output).toPassJudge(
  'Identifies the SQL injection vulnerability and suggests parameterized queries',
  { driver, calibration: 'code-review' }
);
```

### Conditional matchers

```ts
import { when, calledTool } from '@tracepact/core';

// Only assert file read if write_file was called
when(trace, calledTool('write_file'),
  toHaveCalledTool(trace, 'read_file'));
```

---

## Mock sandbox

Test without any API calls using mock tool implementations:

```ts
import { createMockTools, mockReadFile, mockBash, captureWrites, denyAll } from '@tracepact/vitest';

const sandbox = createMockTools({
  read_file:  mockReadFile({ 'src/app.ts': 'export function main() {}' }),
  write_file: captureWrites(),
  bash:       mockBash({ 'npm test': { stdout: 'PASS', exitCode: 0 } }),
  dangerous:  denyAll(),
});
```

---

## Test annotations

Control which tests run based on environment — useful for keeping CI fast:

```ts
import { live, expensive, cheap } from '@tracepact/vitest';

// Runs only when TRACEPACT_LIVE=1
live('calls the real deploy API', async () => { /* ... */ });

// Runs only when TRACEPACT_FULL=1 (Tier 3-4 assertions)
expensive('semantic similarity check', async () => { /* ... */ });

// Always runs — no API keys needed
cheap('basic tool order assertions', async () => { /* ... */ });
```

Tests live in `*.tracepact.ts` files — the Vitest plugin picks them up automatically.

---

## Container sandbox (L2)

Run real tools in isolated Docker containers or lightweight subprocesses:

```ts
// Docker (full isolation)
import { createContainerTools } from '@tracepact/core';

const sandbox = await createContainerTools({
  image: 'node:22-slim',
  tools: ['bash', 'read_file', 'write_file'],
  timeout: 30_000,
});

// Subprocess (no Docker required — works in GitHub Actions, Vercel, serverless)
import { createProcessTools } from '@tracepact/core';

const sandbox = createProcessTools({
  timeout: 30_000,
  allow: {
    fs:   ['src/**', 'test/**'],
    bash: [/^npm /, /^node /],
  },
});
```

The `doctor` command auto-detects which sandbox runtime is available.

---

## Record & replay

Record a live run once, replay it deterministically in CI without API calls:

```ts
import { runSkill } from '@tracepact/vitest';

// Record (requires TRACEPACT_LIVE=1)
const result = await runSkill(skill, {
  prompt: 'deploy to staging',
  record: './cassettes/deploy.json',
  sandbox,
  tools,
});

// Replay (no API key needed)
const replayed = await runSkill(skill, {
  prompt: 'deploy to staging',
  replay: './cassettes/deploy.json',
});

expect(replayed.trace).toHaveCalledTool('deploy', { env: 'staging' });
```

---

## Behavioral drift detection

Compare two cassettes to catch regressions after changing a prompt or model:

```ts
// Via MCP tool in your IDE
tracepact_diff({
  cassette_a: './cassettes/before.json',
  cassette_b: './cassettes/after.json',
})
// { changed: true, additions: ['write_file'], removals: [], diffs: [...] }
```

Useful for prompt engineering: record a baseline, tweak the system prompt, record again, diff.

---

## Promptfoo integration

If you already use [Promptfoo](https://promptfoo.dev) for evals, TracePact's tool-trace assertions plug in directly:

```yaml
# promptfooconfig.yaml
providers:
  - file://./tracepact-provider.js

prompts:
  - "Review {{file}} for security issues"

tests:
  - vars:
      file: src/auth.ts
    assert:
      - type: javascript
        value: |
          const { assertCalledTool } = require("@tracepact/promptfoo");
          return assertCalledTool(output, context, "read_file");
      - type: javascript
        value: |
          const { assertOutputMentions } = require("@tracepact/promptfoo");
          return assertOutputMentions(output, context, "sql injection");
```

See [`@tracepact/promptfoo`](packages/promptfoo) for full setup and assertion reference.

---

## Redaction

Strip API keys and secrets from test results before committing cassettes or publishing CI logs:

```ts
import { RedactionPipeline } from '@tracepact/core';

const pipeline = new RedactionPipeline({
  rules: [{ pattern: /sk-[a-zA-Z0-9]+/g, replacement: '[REDACTED]' }],
  redactEnvValues: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
});

const cleaned = pipeline.redact(text);
```

Redaction runs automatically on cassette recordings and JSON reporter output.

---

## Static audit

Run static analysis on tool definitions and prompts — no API key needed:

```
npx tracepact audit
```

Built-in rules: `toolComboRisk`, `promptHygiene`, `skillCompleteness`, `noOpaqueTools`.

---

## Multi-provider

```ts
import { defineConfig } from '@tracepact/core';

export default defineConfig({
  model: 'anthropic/claude-sonnet-4-5-20250929',
  roles: {
    judge:     'anthropic/claude-haiku-4-5-20251001',
    embedding: 'openai/text-embedding-3-small',
  },
});
```

Native drivers for OpenAI and Anthropic. Compatible with Groq, DeepSeek, Mistral, Together, OpenRouter. Browse models with `npx tracepact models`.

---

## CLI

```
npx tracepact                         # run all tests
npx tracepact --live                  # run against real LLM APIs
npx tracepact --budget 50000          # abort if live tokens exceed 50,000
npx tracepact --record                # record cassettes
npx tracepact --replay ./cassettes    # replay cassettes
npx tracepact --full                  # include L3–L4 tests
npx tracepact --json                  # JSON output for CI

npx tracepact init                    # interactive setup
npx tracepact init --demo             # scaffold demo test suite
npx tracepact models                  # browse available models
npx tracepact audit                   # static analysis (no API key)
npx tracepact capture                 # auto-generate tests from a live run
npx tracepact cost-report             # token cost breakdown
npx tracepact doctor                  # environment health check
```

---

## IDE integration (MCP)

TracePact ships an MCP server so Claude Code, Cursor, and Windsurf can run and interpret tests directly while you build agents.

```json
// Claude Code / .claude/mcp.json
{
  "mcpServers": {
    "tracepact": {
      "command": "npx",
      "args": ["@tracepact/mcp-server"]
    }
  }
}
```

Available MCP tools:

| Tool | What it does |
| --- | --- |
| `tracepact_audit` | Static analysis of a SKILL.md (no API key needed) |
| `tracepact_run` | Execute the test suite via Vitest |
| `tracepact_capture` | Auto-generate tests from a recorded cassette |
| `tracepact_replay` | Replay a cassette without any API calls |
| `tracepact_diff` | Compare two cassettes to detect behavioral drift |
| `tracepact_list_tests` | Discover test files and cassettes for a skill |

Recommended IDE workflow: `audit` → `list_tests` → `run` → `capture` → `diff` after changes.

See [IDE Setup guide](docs/guide/ide-setup.md) for Cursor and Windsurf config.

---

## Packages

| Package | Description |
| --- | --- |
| [`@tracepact/core`](packages/core) | Matchers, trace model, sandboxes, audit engine, drivers, cache, redaction |
| [`@tracepact/vitest`](packages/vitest) | Vitest plugin, matcher registration, `runSkill()`, `test.live()`, `test.expensive()` |
| [`@tracepact/cli`](packages/cli) | CLI commands |
| [`@tracepact/promptfoo`](packages/promptfoo) | Promptfoo provider + assertion adapter |
| [`@tracepact/mcp-server`](packages/mcp-server) | MCP server for IDE integration |

---

## Documentation

- [Quick Start](docs/guide/quick-start.md)
- [Mock vs Live Testing](docs/guide/mock-vs-live.md)
- [CI Integration](docs/guide/ci-integration.md)
- [IDE Setup (MCP)](docs/guide/ide-setup.md)
- [Assertion Reference](docs/reference/assertions.md)
- [Configuration Reference](docs/reference/configuration.md)
- [CLI Reference](docs/reference/cli.md)
- [Semantic Assertions](docs/advanced/semantic-assertions.md)
- [Judge Assertions](docs/advanced/judge-assertions.md)
- [Cassettes (Record & Replay)](docs/advanced/cassettes.md)
- [Flake Scoring](docs/advanced/flake-scoring.md)
- [Promptfoo Integration](docs/promptfoo-integration.md)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and coding standards.

## License

[MIT](LICENSE) © [dcdeve](https://github.com/dcdeve)
