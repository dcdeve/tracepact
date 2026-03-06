# Deployment Agent — TracePact Example

This is a complete example of an AI agent tested with TracePact.
It demonstrates the full flow: audit → capture → run → report.

## What's Here

```
examples/agent-example/
├── SKILL.md                          ← Agent definition
├── cassettes/deploy-staging.json     ← Recorded agent behavior
├── tests/deploy.test.ts              ← Auto-generated test (4 assertions)
└── README.md                         ← This file
```

## The Agent

A deployment agent that:
1. Reads project config
2. Runs the test suite
3. Deploys to staging (never production)
4. Writes a deployment log

## Demo Flow

### 1. Audit the agent

```bash
# Via CLI
tracepact audit ./examples/agent-example/SKILL.md

# Via MCP (the IDE AI calls this automatically)
# tracepact_audit({ skill_path: "./examples/agent-example/SKILL.md" })
```

Result: `riskLevel: medium` — agent has bash + write_file access.

### 2. Run existing tests (replay mode)

```bash
tracepact run
```

Uses the pre-recorded cassette — no API calls, instant results.

### 3. Capture new behavior

```bash
tracepact capture \
  --skill ./examples/agent-example/SKILL.md \
  --prompt "deploy to staging" \
  --dry-run \
  --cassette ./examples/agent-example/cassettes/deploy-staging.json
```

Generates a test file with inferred assertions.

### 4. Diff after changes

If the agent behavior changes, record a new cassette and diff:

```bash
# tracepact_diff({
#   cassette_a: "./cassettes/deploy-staging-v1.json",
#   cassette_b: "./cassettes/deploy-staging-v2.json"
# })
```

## MCP Server Setup

Register `@tracepact/mcp-server` in your IDE and say:
**"test this agent"** — the AI will run the full flow automatically.

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
