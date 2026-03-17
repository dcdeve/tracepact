# IDE Setup — MCP Server

TracePact exposes its functionality as MCP tools. Register the server
in your IDE, then ask your AI to "test this agent" — it handles the rest.

## Install

```bash
npm install -D @tracepact/mcp-server
```

## Configuration by IDE

### Cursor

Create or edit `.cursor/mcp.json`:

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

### Claude Code

Create or edit `.claude/mcp.json`:

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

### OpenCode

Create or edit `.opencode/mcp.json`:

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

### Windsurf

Create or edit `.windsurf/mcp.json`:

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

### Copilot (VS Code)

Create or edit `.vscode/mcp.json`:

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

## Available Tools

Once configured, these tools are available to your IDE's AI:

| Tool | Description |
|------|-------------|
| `tracepact_audit` | Static risk analysis of SKILL.md — no API key needed, runs instantly |
| `tracepact_capture` | Generate a test file from a recorded cassette |
| `tracepact_run` | Execute TracePact tests; mock mode by default, live mode optional |
| `tracepact_diff` | Compare two cassettes to detect behavioral drift |
| `tracepact_list_tests` | Find tests and cassettes for a skill |
| `tracepact_replay` | Replay a cassette without making any API calls |

## Usage

After setup, just tell your AI:

- "test this agent"
- "audit this SKILL.md"
- "capture the behavior of this agent"
- "check if this agent is safe"

The AI will call the appropriate TracePact tools automatically.
