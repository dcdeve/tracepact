# @tracepact/vitest

Vitest integration for TracePact — custom matchers, test helpers, and a plugin for testing AI agents.

## Installation

```bash
npm install @tracepact/vitest @tracepact/core vitest
```

## Setup

```typescript
// vitest.config.ts (or tracepact.vitest.ts)
import { defineConfig } from 'vitest/config';
import { tracepactPlugin } from '@tracepact/vitest';

export default defineConfig({
  plugins: [tracepactPlugin()],
});
```

The plugin automatically:
- Includes `*.tracepact.ts` files as test files
- Loads the setup file that registers custom matchers
- Sets a 30s default timeout for agent tests

## Writing Tests

```typescript
// agent.tracepact.ts
import { describe, it, expect } from 'vitest';
import { runSkill, createMockTools, mockReadFile, captureWrites } from '@tracepact/vitest';

describe('code-reviewer', () => {
  const sandbox = createMockTools({
    read_file: mockReadFile({ 'src/main.ts': 'const x = eval(input)' }),
    write_file: captureWrites(),
  });

  it('reads the file and flags eval()', async () => {
    const result = await runSkill('./SKILL.md', {
      prompt: 'Review src/main.ts',
      sandbox,
    });

    // Tier 0 — Tool call assertions
    expect(result.trace).toHaveCalledTool('read_file');
    expect(result.trace).toNotHaveCalledTool('bash');
    expect(result.trace).toHaveCalledToolsInOrder(['read_file', 'write_file']);

    // Tier 1 — Structural
    expect(result).toHaveMarkdownStructure({ headings: ['## Review'] });

    // Tier 2 — Content
    expect(result).toMention('eval');
    expect(result).toContainAny(['vulnerability', 'security']);
  });
});
```

## Custom Matchers

All matchers from `@tracepact/core` are registered as Vitest matchers:

### Tier 0 — Tool Calls
- `toHaveCalledTool(toolName, args?)` — Tool was called (optionally with matching args)
- `toNotHaveCalledTool(toolName)` — Tool was never called
- `toHaveCalledToolsInOrder(toolNames[])` — Tools called in subsequence order
- `toHaveCalledToolsInStrictOrder(toolNames[])` — Exact call order
- `toHaveToolCallCount(toolName, count)` — Exact call count
- `toHaveFirstCalledTool(toolName)` — First tool called
- `toHaveLastCalledTool(toolName)` — Last tool called

### Tier 1 — Structure
- `toHaveMarkdownStructure(spec)` — Markdown headings/sections
- `toMatchJsonSchema(schema)` — JSON schema validation
- `toHaveLineCount(spec)` — Line count range
- `toHaveFileWritten(path)` — File was written via sandbox

### Tier 2 — Content
- `toContain(text)` — Text present in output
- `toNotContain(text)` — Text absent
- `toMention(term)` — Mentions a term (with stemming support)
- `toContainAll(terms[])` — All terms present
- `toContainAny(terms[])` — At least one term present

### Tier 3 — Semantic (async)
- `toBeSemanticallySimilar(text, opts?)` — Embedding cosine similarity
- `toHaveSemanticOverlap(topics[], opts?)` — Overlaps with topic list

### Tier 4 — Judge (async)
- `toPassJudge(criterion, opts?)` — LLM evaluates against a criterion
- `toMatchTrajectory(trajectory)` — LLM validates execution trajectory

### MCP & RAG matchers
- `toHaveCalledMcpTool(server, tool)`, `toHaveCalledMcpServer(server)`, etc.
- `toHaveRetrievedDocument(id)`, `toHaveCitedSources(sources)`, etc.

## Test Annotations

Control which tests run based on environment:

```typescript
import { live, expensive, cheap } from '@tracepact/vitest';

// Runs only when TRACEPACT_LIVE=1
live('calls real API', async () => { /* ... */ });

// Runs only when TRACEPACT_FULL=1
expensive('semantic similarity check', async () => { /* ... */ });

// Always runs (default)
cheap('basic tool assertions', async () => { /* ... */ });
```

## Token Tracking

Track and enforce token budgets during live test runs:

```typescript
import { globalTokens, writeTokenReport } from '@tracepact/vitest';

// After tests, inspect usage
console.log(globalTokens.total());

// Or set a budget via env/CLI
// TRACEPACT_BUDGET=100000 npx tracepact --live
```

## JSON Reporter

Write test results to `.tracepact/results.json` with automatic redaction:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    reporters: ['default', '@tracepact/vitest/json-reporter'],
  },
});
```

## Re-exports from Core

For convenience, commonly used utilities are re-exported:

- `createMockTools`, `mockReadFile`, `mockWriteFile`, `captureWrites`
- `mockBash`, `denyAll`, `passthrough`
- `defineTools`, `parseSkill`, `MockSandbox`, `TraceBuilder`

## Running

```bash
# Mock mode (no API keys)
npx tracepact

# Live mode
TRACEPACT_LIVE=1 npx tracepact

# Full mode (includes expensive Tier 3-4 tests)
TRACEPACT_FULL=1 TRACEPACT_LIVE=1 npx tracepact
```

## License

MIT
