# Mock vs Live Testing

## Key Concepts

### Sandbox vs Tools

These are two separate concepts that work together:

- **Sandbox** (`createMockTools`) — defines mock *implementations* for tools. Controls what happens when a tool is called (return data, deny access, capture writes). Used for both mock and live tests.
- **Tools** (`defineTools`) — declares tool *schemas* for the LLM. Tells the model which tools exist and their parameter types. Required for live tests so the LLM knows tools are available.

```typescript
import { createMockTools, mockReadFile, denyAll, defineTools } from '@tracepact/vitest';
import { z } from 'zod';

// 1. Sandbox: what happens when tools are called
const sandbox = createMockTools({
  read_file: mockReadFile({ 'src/index.ts': 'export const main = () => {}' }),
  bash: denyAll(),
});

// 2. Tools: tell the LLM what tools exist (for live tests)
const tools = defineTools({
  read_file: z.object({ path: z.string() }),
  bash: z.object({ command: z.string() }),
});
```

Without `tools`, the LLM won't know tools exist and will generate plain text with zero tool calls.

`defineTools` accepts both zod schemas and plain JSON schemas:

```typescript
// JSON schema alternative (no zod dependency)
const tools = defineTools({
  read_file: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
});
```

### runSkill vs executePrompt

| | `runSkill` | `executePrompt` |
|---|---|---|
| **Package** | `@tracepact/vitest` | `@tracepact/core` |
| **Requires** | `TRACEPACT_LIVE=1` or `replay` path | Always executes live |
| **Use case** | Vitest tests with tier annotations | Direct live calls |
| **Without live/replay** | Warns and returns empty mock result (see below) | Calls the LLM API |

> **What happens when `runSkill()` runs without `TRACEPACT_LIVE=1` and no `replay` path?**
>
> It prints a `console.warn` and returns an empty result: `output: ''`, empty trace from the sandbox, zero tokens, and zero duration. This is intentional — mock-only tests should use sandbox directly, not `runSkill()`. If you need to call the LLM, either set `TRACEPACT_LIVE=1` or use `executePrompt()` from `@tracepact/core`.

```typescript
// In vitest tests — respects TRACEPACT_LIVE
import { runSkill } from '@tracepact/vitest';
const result = await runSkill(skill, { prompt: 'deploy', sandbox, tools });

// Direct live call — always executes
import { executePrompt } from '@tracepact/core';
const result = await executePrompt(skill, { prompt: 'deploy', sandbox, tools });
```

## Mock Mode (default)

Tests run offline using mock tools. No API keys needed.

```typescript
import { describe, expect, test } from 'vitest';
import { createMockTools, mockReadFile, denyAll } from '@tracepact/vitest';

const sandbox = createMockTools({
  read_file: mockReadFile({ 'config.json': '{"env": "staging"}' }),
  bash: denyAll(),
});

describe('my agent', () => {
  test('reads config', async () => {
    const result = await sandbox.executeTool('read_file', { path: 'config.json' });
    expect(result.type).toBe('success');
    expect(result.content).toContain('staging');
  });
});
```

## Live Mode

Tests call real LLM APIs. Enable with `--live`:

```bash
npx tracepact --live
```

Or in code with the `live` annotation:

```typescript
import { live } from '@tracepact/vitest';

live('agent handles edge case', async () => {
  const result = await runSkill(skill, {
    prompt: 'deploy to staging',
    sandbox,
    tools,
  });
  expect(result.output).toContain('deployed');
});
```

## Record & Replay

Record a live run, then replay in CI:

```bash
# Record
npx tracepact --record --live

# Replay (default — no API calls)
npx tracepact
```

## Tips

### healthCheck returns full model version

`driver.healthCheck()` returns the exact model version from the API (e.g. `"gpt-4o-mini-2024-07-18"`, not `"gpt-4o-mini"`). Use `toContain` instead of `toBe` when asserting:

```typescript
const health = await driver.healthCheck();
expect(health.model).toContain('gpt-4o-mini');
```

### Glob patterns in sandbox and ProcessSandbox

`mockReadFile` and `ProcessSandbox` allowlists support glob patterns. `**/*.ext` matches files at any depth **including the root**:

```typescript
const sandbox = createMockTools({
  read_file: mockReadFile({
    '**/*.ts': '// typescript file',   // matches index.ts, src/app.ts, a/b/c.ts
    'src/*.ts': '// src only',         // matches src/app.ts but NOT src/lib/util.ts
  }),
});
```

- `**` matches any number of directories (including zero)
- `*` matches within a single directory (does not cross `/`)

### Semantic assertions need descriptive topics

`toHaveSemanticOverlap` compares embeddings. Short single-word topics like `"deployment"` have low cosine similarity against full paragraphs. Use descriptive phrases:

```typescript
// Bad — cosine similarity too low
expect(result).toHaveSemanticOverlap(['deployment', 'testing']);

// Good — descriptive phrases match better
expect(result).toHaveSemanticOverlap([
  'deploy application to staging environment',
  'run automated test suite',
]);
```
