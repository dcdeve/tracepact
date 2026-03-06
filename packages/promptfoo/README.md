# @tracepact/promptfoo

Promptfoo integration for TracePact — use TracePact's tool-trace assertions directly in your Promptfoo eval configs.

## Installation

```bash
npm install @tracepact/promptfoo @tracepact/core
```

## Overview

This package provides two things:

1. **`TracepactProvider`** — A Promptfoo-compatible provider that runs an agent with mocked tools and returns the trace as metadata.
2. **Assertion functions** — 6 assertion wrappers that check tool traces in Promptfoo's `assert` blocks.

## Provider Setup

Create a provider file for your Promptfoo config:

```javascript
// tracepact-provider.js
const { TracepactProvider } = require('@tracepact/promptfoo');

module.exports = new TracepactProvider({
  skill: './SKILL.md',
  provider: 'openai',
  model: 'gpt-4o',
  tools: {
    read_file: {
      type: 'readFile',
      files: {
        'src/auth.ts': 'const query = `SELECT * FROM users WHERE id = ${id}`;',
      },
    },
    write_file: { type: 'deny' },
  },
});
```

Reference it in `promptfooconfig.yaml`:

```yaml
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

## Provider Config

```typescript
interface TracepactProviderConfig {
  skill?: string;           // Path to SKILL.md
  systemPrompt?: string;    // Or inline system prompt
  provider?: string;        // "openai" | "groq" | "deepseek" | "mistral" | "together" | "openrouter"
  model?: string;           // Model ID (default: "gpt-4o")
  apiKey?: string;          // API key (overrides env var)
  baseURL?: string;         // Custom endpoint
  tools?: Record<string, ToolMockConfig>;
  maxToolIterations?: number;
}

interface ToolMockConfig {
  type: 'readFile' | 'writeFile' | 'bash' | 'deny' | 'passthrough';
  files?: Record<string, string>;  // For readFile type
}
```

## Assertion Functions

All return `{ pass: boolean, score: number, reason: string }` compatible with Promptfoo's assertion format.

### `assertCalledTool(output, context, toolName, args?)`

Verify the agent called a specific tool, optionally with matching arguments.

```yaml
- type: javascript
  value: |
    const { assertCalledTool } = require("@tracepact/promptfoo");
    return assertCalledTool(output, context, "read_file", { path: "src/auth.ts" });
```

### `assertNotCalledTool(output, context, toolName)`

Verify the agent did NOT call a tool.

```yaml
- type: javascript
  value: |
    const { assertNotCalledTool } = require("@tracepact/promptfoo");
    return assertNotCalledTool(output, context, "write_file");
```

### `assertCalledToolsInOrder(output, context, toolNames)`

Verify tools were called in a specific order (subsequence match).

```yaml
- type: javascript
  value: |
    const { assertCalledToolsInOrder } = require("@tracepact/promptfoo");
    return assertCalledToolsInOrder(output, context, ["read_file", "write_file"]);
```

### `assertToolCallCount(output, context, toolName, count)`

Verify a tool was called exactly N times.

```yaml
- type: javascript
  value: |
    const { assertToolCallCount } = require("@tracepact/promptfoo");
    return assertToolCallCount(output, context, "read_file", 2);
```

### `assertOutputContains(output, context, pattern)`

Verify the output matches a regex pattern (case-insensitive).

```yaml
- type: javascript
  value: |
    const { assertOutputContains } = require("@tracepact/promptfoo");
    return assertOutputContains(output, context, "sql injection|parameterized");
```

### `assertOutputMentions(output, context, term, options?)`

Verify the output mentions a term (with optional stemming).

```yaml
- type: javascript
  value: |
    const { assertOutputMentions } = require("@tracepact/promptfoo");
    return assertOutputMentions(output, context, "vulnerability", { stem: true });
```

## How It Works

1. The provider receives a prompt from Promptfoo
2. It parses the skill file and builds a mock sandbox from the `tools` config
3. It runs the agent via `@tracepact/core`'s driver
4. The response includes `output` + `metadata.trace` (the full tool call trace)
5. Assertion functions extract the trace from `context.metadata.trace` and run TracePact's core matchers

## Examples

See [`examples/promptfoo/`](../../examples/promptfoo/) for complete working examples:

- **security-reviewer** — Tests a code review agent that reads files and identifies vulnerabilities
- **doc-writer** — Tests a documentation agent that reads source files and writes docs

## License

MIT
