# @tracepact/mcp-server

MCP (Model Context Protocol) server that exposes TracePact as tools for agentic IDEs.

## Installation

```bash
npm install -g @tracepact/mcp-server
```

## Usage

The server communicates via stdio and is designed to be registered in your IDE's MCP configuration.

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "tracepact": {
      "command": "tracepact-mcp-server"
    }
  }
}
```

The server provides instructions that guide agents on the recommended tool usage order.

## Available Tools

### `tracepact_audit`

Static analysis of a SKILL.md file. No API key needed.

**Input:**
- `skill_path` — Path to the SKILL.md file

**Output:**
- `riskLevel` — "none" | "low" | "medium" | "high" | "critical"
- `pass` — Whether the audit passed
- `findings` — Array of issues found
- `summary` — Counts by severity (critical, high, medium, low)

Checks for risky tool combinations, prompt hygiene, skill completeness, and opaque tools.

### `tracepact_run`

Execute TracePact tests via Vitest.

**Input:**
- `skill_path` — Path to SKILL.md or test directory
- `live` (optional) — Run against real LLM APIs (default: false)
- `provider` (optional) — LLM provider name
- `budget` (optional) — Max token budget

**Output:**
- `pass` — Whether all tests passed
- `output` — Vitest JSON output
- `error` — Error message if failed

Timeout: 120 seconds.

### `tracepact_capture`

Auto-generate a test file from a recorded cassette.

**Input:**
- `skill_path` — Path to SKILL.md
- `prompt` — Representative prompt for assertion inference

**Output:**
- `testFile` — Generated test code
- `cassettePath` — Path to cassette used
- `assertionsGenerated` — Number of assertions inferred

### `tracepact_replay`

Replay a cassette without calling any API.

**Input:**
- `cassette_path` — Path to cassette JSON file

**Output:**
- `pass` — Whether replay succeeded
- `trace` — Full trace object with calls, totalCalls, totalDurationMs

### `tracepact_diff`

Compare two cassette recordings to detect behavioral drift.

**Input:**
- `cassette_a` — Baseline cassette path (before change)
- `cassette_b` — Comparison cassette path (after change)

**Output:**
- `changed` — Whether behavior differs
- `additions` — Tool calls in B but not A
- `removals` — Tool calls in A but not B
- `diffs` — Argument changes per tool call

### `tracepact_list_tests`

Find test files and cassettes associated with a skill.

**Input:**
- `skill_path` — Path to SKILL.md

**Output:**
- `tests` — Array of `{path, name}` for `.test.ts` / `.test.js` files
- `cassettes` — Array of cassette files found in `cassettes/` or `__cassettes__/`

## Recommended Workflow

A typical agentic IDE workflow:

1. **`tracepact_audit`** — Analyze the skill file for issues
2. **`tracepact_list_tests`** — Discover existing tests and cassettes
3. **`tracepact_run`** — Execute the test suite
4. **`tracepact_capture`** — Generate new tests from cassettes
5. **`tracepact_diff`** — Compare cassettes after changes
6. **`tracepact_replay`** — Quick validation without API calls

## License

MIT
