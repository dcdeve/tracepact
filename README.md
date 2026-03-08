# TracePact

**Catch tool-call regressions before they hit production.**

[![npm version](https://img.shields.io/npm/v/@tracepact/core.svg)](https://www.npmjs.com/package/@tracepact/core)
[![CI](https://img.shields.io/github/actions/workflow/status/dcdeve/tracepact/ci.yml?branch=main)](https://github.com/dcdeve/tracepact/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/dcdeve/tracepact)](https://github.com/dcdeve/tracepact/blob/main/LICENSE)
[![node version](https://img.shields.io/node/v/@tracepact/core.svg)](https://nodejs.org)

---

Most agent failures don't look like bad text. They look like this:

- yesterday your agent read context, validated input, then wrote changes
- today, after a prompt tweak, it writes too early
- the final answer still looks plausible
- production is now broken

TracePact catches that. Record a known-good run, replay it in CI without API calls, and diff against new runs to see exactly what changed — which tools, in what order, with what arguments.

```bash
# 1. Record a baseline (one-time, live)
npx tracepact run --live --record

# 2. Change your prompt, model, or tool wiring

# 3. Record again and diff
npx tracepact run --live --record
npx tracepact diff cassettes/before.json cassettes/after.json

# 4. CI: fail on behavioral regressions
npx tracepact diff baseline.json latest.json --fail-on warn

# Ignore noisy args (timestamps, request IDs)
npx tracepact diff baseline.json latest.json --ignore-keys timestamp,requestId

# Ignore tools you don't care about
npx tracepact diff baseline.json latest.json --ignore-tools read_file
```

```
  Comparing cassettes
  A: cassettes/before.json
  B: cassettes/after.json

  3 changes detected:

  - read_file (seq 1) (removed)
  + write_file (seq 3) (added)
  ~ bash.cmd: "npm test" -> "npm run build"

  Summary: 1 removed, 1 added, 1 arg changed  [BLOCK]
```

You changed the prompt. The output still looks fine. But the agent stopped reading the config before deploying and switched from running tests to running builds. TracePact caught it.

---

## The problem teams solve manually today

Teams already try to catch this, but usually in fragile ways:

- manually reviewing traces in agent UIs
- parsing raw session logs after tests
- writing custom hooks to extract tool calls
- comparing old vs new runs by hand
- debugging regressions only after a user reports them

TracePact turns that into **deterministic tests** and **replayable behavior contracts**.

---

## Typical behavior contracts

TracePact is designed for assertions like these:

- read before write
- validate input before mutation
- never call shell for read-only tasks
- never call destructive tools without confirmation
- look up an existing record before creating a new one
- query the database before writing cache
- run tests before finishing a code-editing task
- inspect logs before restart actions
- do not write outside allowed paths
- do not call sensitive tools in low-trust flows

These are often easier and more stable than trying to assert that an entire response is "good."

---

## Example: catch a regression after a prompt change

A coding agent should read enough context before editing code.

```ts
import { describe, expect, test } from 'vitest';
import { TraceBuilder } from '@tracepact/vitest';

describe('refactor agent', () => {
  test('reads context before editing code', () => {
    const trace = new TraceBuilder()
      .addCall('read_file', { path: 'src/service.ts' }, '...')
      .addCall('read_file', { path: 'src/types.ts' }, '...')
      .addCall('write_file', { path: 'src/service.ts', content: '...' })
      .addCall('run_tests', {}, 'PASS')
      .build();

    expect(trace).toHaveCalledToolsInOrder([
      'read_file', 'read_file', 'write_file', 'run_tests',
    ]);
    expect(trace).toHaveToolCallCount('read_file', 2);
    expect(trace).toNotHaveCalledTool('bash');
  });
});
```

This test fails immediately if a prompt or model change causes the agent to write before reading, skip required steps, or introduce a forbidden tool call.

No API calls. No tokens. Deterministic. Runs in milliseconds.

---

## Record once, replay in CI

Capture a known-good run once, then replay it to detect drift caused by changes to system prompts, model choice, tool descriptions, agent logic, or MCP server wiring.

```ts
import { runSkill } from '@tracepact/vitest';

// Record (requires TRACEPACT_LIVE=1)
const result = await runSkill(skill, {
  prompt: 'deploy to staging',
  record: './cassettes/deploy.json',
  sandbox,
});

// Replay (no API key needed, instant)
const replayed = await runSkill(skill, {
  prompt: 'deploy to staging',
  replay: './cassettes/deploy.json',
});

expect(replayed.trace).toHaveCalledTool('deploy', { env: 'staging' });
```

Or use the CLI with automatic cassette recording:

```bash
# Record all tests (cassettes saved automatically)
npx tracepact run --live --record

# Replay all tests (zero tokens, instant)
npx tracepact run --replay ./cassettes
```

---

## Good fit

TracePact is especially useful for agents that use multiple tools, operate across several steps, mutate files or systems, and can silently regress after prompt or model updates.

### Coding agents

Agents that read files, search code, edit code, run tests, use shell, open PRs.

Typical contracts: read context before writing, do not use shell unless required, run tests before completion, never edit restricted files.

### Internal developer assistants

Agents that use GitHub, Jira, Slack, docs, or internal APIs via MCP servers.

Typical contracts: use the correct system for the correct task, do not update tickets before validating context.

### Ops and incident-response agents

Agents that inspect logs, query metrics, read runbooks, restart services.

Typical contracts: inspect before acting, never restart before checking evidence, require confirmation for destructive steps.

### Workflow automation agents

Agents that create tickets, update CRM records, reconcile data, route tasks.

Typical contracts: validate required fields before mutation, look up existing records before creating new ones, avoid duplicate side effects.

---

## Less useful for

TracePact is not primarily for pure chatbots, style or tone evaluation, open-ended creative tasks, or systems where only the final text matters.

Use TracePact for **behavioral guarantees**. Use semantic or judge-based evals for **response quality**. They complement each other — TracePact includes a [Promptfoo adapter](packages/promptfoo) for exactly this.

---

## Tool call assertions

```ts
// Did it call the right tools?
expect(trace).toHaveCalledTool('read_file', { path: 'config.json' });
expect(trace).toNotHaveCalledTool('bash');
expect(trace).toHaveToolCallCount('read_file', 3);

// In the right order?
expect(trace).toHaveCalledToolsInOrder(['read_file', 'write_file']);
expect(trace).toHaveCalledToolsInStrictOrder(['read_file', 'write_file']);
expect(trace).toHaveFirstCalledTool('read_file');
expect(trace).toHaveLastCalledTool('write_file');

// With the right side effects?
expect(trace).toHaveFileWritten('output.ts', /export/);

// Conditional contracts
import { when, calledTool } from '@tracepact/core';
when(trace, calledTool('write_file'), toHaveCalledTool(trace, 'read_file'));
```

---

## MCP tracing

If your agent calls MCP servers, TracePact traces which server handled each tool call:

```ts
expect(trace).toHaveCalledMcpTool('filesystem', 'read_text_file');
expect(trace).toHaveCalledMcpServer('database');
expect(trace).toHaveCalledMcpToolsInOrder([
  { server: 'filesystem', tool: 'read_text_file' },
  { server: 'database', tool: 'query' },
]);
expect(trace).toNotHaveCalledMcpTool('filesystem', 'write_file');
```

You can also connect to real MCP servers for integration tests:

```ts
import { connectMcp, MockSandbox } from '@tracepact/vitest';

const fs = await connectMcp({
  server: 'filesystem',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/project'],
});

const sandbox = new MockSandbox(fs.handlers, fs.sources);
const result = await sandbox.executeTool('read_text_file', {
  path: '/project/README.md',
});

expect(sandbox.getTrace()).toHaveCalledMcpServer('filesystem');
```

---

## Why not just use output evals?

Because outputs can remain plausible while behavior quietly changes.

You can change the prompt, the model, the tool schema, the routing logic, or the retry policy — and still get a response that looks acceptable. Meanwhile the agent may have skipped validation, touched the wrong tool, reordered critical steps, or mutated state too early.

Output evals answer "did it say the right thing?" TracePact answers "did it **do** the right thing?"

---

## Why not just hand-roll mocks?

For simple flows, you can. But the hard part is not a single mock. The hard part is having a reusable way to work with traces, assertions, replay, diffing, MCP workflows, and CI-friendly regression checks across an agent that keeps evolving.

TracePact becomes useful when your agent behavior stops being trivial.

---

## Quickstart

```bash
npm install @tracepact/core @tracepact/vitest @tracepact/cli
npx tracepact init          # interactive setup
npx tracepact               # run all tests
```

---

## CLI

```
npx tracepact                         # run all tests
npx tracepact run --live              # run against real LLM APIs
npx tracepact run --record            # record cassettes (implies --live)
npx tracepact run --replay ./dir      # replay without API calls
npx tracepact diff a.json b.json      # compare two cassettes
npx tracepact diff a.json b.json --fail-on warn    # fail CI on any drift
npx tracepact diff a.json b.json --fail-on block   # fail only on structural changes
npx tracepact diff a.json b.json --ignore-keys timestamp  # skip noisy args
npx tracepact diff a.json b.json --ignore-tools read_file # skip tools you don't care about
npx tracepact audit                   # static analysis (no API key)
npx tracepact capture                 # auto-generate tests from live run
npx tracepact init                    # interactive setup
npx tracepact doctor                  # environment health check
```

---

## IDE integration (MCP)

TracePact ships an MCP server for Claude Code, Cursor, and Windsurf:

```json
{
  "mcpServers": {
    "tracepact": {
      "command": "npx",
      "args": ["@tracepact/mcp-server"]
    }
  }
}
```

| Tool | What it does |
| --- | --- |
| `tracepact_audit` | Static analysis of tool definitions |
| `tracepact_run` | Execute the test suite |
| `tracepact_capture` | Auto-generate tests from a cassette |
| `tracepact_replay` | Replay a cassette without API calls |
| `tracepact_diff` | Compare two cassettes for behavioral drift |
| `tracepact_list_tests` | Discover test files and cassettes |

---

## Packages

| Package | Description |
| --- | --- |
| [`@tracepact/core`](packages/core) | Trace model, matchers, sandboxes, drivers, cassettes, redaction |
| [`@tracepact/vitest`](packages/vitest) | Vitest plugin, `runSkill()`, test annotations |
| [`@tracepact/cli`](packages/cli) | CLI commands |
| [`@tracepact/promptfoo`](packages/promptfoo) | Promptfoo provider + assertion adapter |
| [`@tracepact/mcp-server`](packages/mcp-server) | MCP server for IDE integration |

---

## Roadmap

- [x] Record & replay (cassettes)
- [x] Tool call matchers and MCP tracing
- [x] Behavioral drift detection (diff)
- [x] Promptfoo integration
- [x] MCP server for IDEs
- [x] `tracepact diff` CLI command
- [x] Diff policy: `--ignore-keys`, `--ignore-tools`, severity levels (`--fail-on warn|block`)
- [ ] `tracepact show` — visual trace timeline
- [ ] Invariant discovery (analyze traces, suggest contracts)
- [ ] SDK adapters (Vercel AI SDK, Anthropic SDK, OpenAI SDK)

---

## Documentation

- [Quick Start](docs/guide/quick-start.md)
- [Mock vs Live Testing](docs/guide/mock-vs-live.md)
- [CI Integration](docs/guide/ci-integration.md)
- [Cassettes (Record & Replay)](docs/advanced/cassettes.md)
- [Assertion Reference](docs/reference/assertions.md)
- [CLI Reference](docs/reference/cli.md)
- [Promptfoo Integration](docs/promptfoo-integration.md)
- [IDE Setup (MCP)](docs/guide/ide-setup.md)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and coding standards.

## License

[MIT](LICENSE) © [dcdeve](https://github.com/dcdeve)
