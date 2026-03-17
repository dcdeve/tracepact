# Using TracePact with Promptfoo

`@tracepact/promptfoo` lets you use TracePact's tool-trace assertions inside your Promptfoo eval configs. Test that your AI agent calls the right tools, in the right order, without switching frameworks.

## Install

```bash
npm install @tracepact/promptfoo @tracepact/core
```

## Setup the provider

Create a `tracepact-provider.js` file in your eval directory:

```javascript
const { TracepactProvider } = require("@tracepact/promptfoo");
module.exports = class extends TracepactProvider {};
```

Then reference it in `promptfooconfig.yaml`:

```yaml
providers:
  - id: "file://./tracepact-provider.js"
    config:
      skill: "./SKILL.md"          # path to your SKILL.md
      # systemPrompt: "You are…"  # or use an inline prompt
      provider: openai              # openai, anthropic, groq, deepseek, mistral, together, openrouter, xai, cerebras, fireworks, perplexity
      model: gpt-4o
      tools:
        read_file:
          type: readFile
          files:
            "src/app.ts": |
              // your mock file content here
        write_file:
          type: deny
```

### Provider config options

| Option | Description |
|--------|-------------|
| `skill` | Path to a SKILL.md file |
| `systemPrompt` | Inline system prompt (alternative to `skill`) |
| `provider` | Provider name: `openai`, `anthropic`, `groq`, `deepseek`, `mistral`, `together`, `openrouter`, `xai`, `cerebras`, `fireworks`, `perplexity` |
| `model` | Model ID (e.g., `gpt-4o`, `llama-3.3-70b`) |
| `apiKey` | API key (defaults to env var) |
| `baseURL` | Custom base URL (overrides preset) |
| `tools` | Mock tool definitions (see below) |
| `maxToolIterations` | Max tool-use loop iterations |

### Tool mock types

| Type | Description |
|------|-------------|
| `readFile` | Returns mock file contents. Set `files: { "path": "content" }` |
| `writeFile` | Captures writes (records path + content) |
| `deny` | Returns an error for any call |
| `passthrough` | Returns a generic success response |
| `bash` | Same as `passthrough` |

## Add assertions

Use TracePact assertions in Promptfoo's `type: javascript` assertions:

```yaml
tests:
  - vars:
      file: "src/app.ts"
    assert:
      # Check that the agent called a specific tool
      - type: javascript
        value: |
          const { assertCalledTool } = require("@tracepact/promptfoo");
          return assertCalledTool(output, context, "read_file");

      # Check that the agent did NOT call a tool
      - type: javascript
        value: |
          const { assertNotCalledTool } = require("@tracepact/promptfoo");
          return assertNotCalledTool(output, context, "write_file");

      # Check tool call order
      - type: javascript
        value: |
          const { assertCalledToolsInOrder } = require("@tracepact/promptfoo");
          return assertCalledToolsInOrder(output, context, ["read_file", "write_file"]);

      # Check tool call count
      - type: javascript
        value: |
          const { assertToolCallCount } = require("@tracepact/promptfoo");
          return assertToolCallCount(output, context, "read_file", 2);

      # Check output contains a pattern (regex)
      - type: javascript
        value: |
          const { assertOutputContains } = require("@tracepact/promptfoo");
          return assertOutputContains(output, context, "sql injection|parameterized");

      # Check output mentions a term (with optional stemming)
      - type: javascript
        value: |
          const { assertOutputMentions } = require("@tracepact/promptfoo");
          return assertOutputMentions(output, context, "vulnerability", { stem: true });
```

### Available assertions

| Function | Parameters | Description |
|----------|-----------|-------------|
| `assertCalledTool` | `output, context, toolName, args?` | Tool was called (optionally with specific args) |
| `assertNotCalledTool` | `output, context, toolName` | Tool was NOT called |
| `assertCalledToolsInOrder` | `output, context, toolNames[]` | Tools were called in this order (subsequence match) |
| `assertToolCallCount` | `output, context, toolName, count` | Tool was called exactly N times |
| `assertOutputContains` | `output, context, pattern` | Output matches regex pattern (case-insensitive) |
| `assertOutputMentions` | `output, context, term, options?` | Output mentions term (with optional `{ stem: true }`) |

All assertions return `{ pass: boolean, score: number, reason: string }` per Promptfoo's assertion interface.

## Full example

A complete security reviewer eval:

```yaml
# promptfooconfig.yaml
description: "Security reviewer eval"

providers:
  - id: "file://./tracepact-provider.js"
    config:
      skill: "./SKILL.md"
      provider: openai
      model: gpt-4o
      tools:
        read_file:
          type: readFile
          files:
            "src/auth.ts": |
              const query = `SELECT * FROM users WHERE id = '${userId}'`;
              export function login(userId: string) {
                return db.execute(query);
              }
            "src/safe.ts": |
              export function add(a: number, b: number) {
                return a + b;
              }
        write_file:
          type: deny

prompts:
  - "Review {{file}} for security issues."

tests:
  - vars:
      file: "src/auth.ts"
    assert:
      - type: javascript
        value: |
          const { assertCalledTool } = require("@tracepact/promptfoo");
          return assertCalledTool(output, context, "read_file");
      - type: javascript
        value: |
          const { assertOutputContains } = require("@tracepact/promptfoo");
          return assertOutputContains(output, context, "injection");

  - vars:
      file: "src/safe.ts"
    assert:
      - type: javascript
        value: |
          const { assertCalledTool } = require("@tracepact/promptfoo");
          return assertCalledTool(output, context, "read_file");
      - type: javascript
        value: |
          const { assertNotCalledTool } = require("@tracepact/promptfoo");
          return assertNotCalledTool(output, context, "write_file");
```

## Running

```bash
npx promptfoo eval
npx promptfoo view    # open the web UI to see results
```

## Limitations

- **Trace assertions require the TracePact provider.** If you use a standard Promptfoo provider (e.g., `openai:gpt-4o`), there is no tool trace — `assertCalledTool` and similar assertions will fail with "No tool trace found."
- **Mock tools only.** The TracePact provider uses mock tools (no real file system access). This is intentional for safe, reproducible evals.
- **One provider config per test set.** If you need different mock files for different tests, create separate promptfoo config files or use Promptfoo's `scenarios` feature.
