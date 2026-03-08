# @tracepact/core

Core library for TracePact — the behavioral testing framework for AI agents.

This package provides the foundational building blocks: LLM drivers, tool sandboxing, trace collection, multi-tier assertion matchers, caching, cassette recording/replay, and more. All other TracePact packages depend on this one.

## Installation

```bash
npm install @tracepact/core
```

## Key Concepts

### Skills

A **skill** is a YAML-frontmatter markdown file (`SKILL.md`) that defines an agent's system prompt, available tools, and behavioral constraints.

```typescript
import { parseSkill } from '@tracepact/core';

const skill = await parseSkill('SKILL.md');
// skill.frontmatter — {name, description, triggers, excludes, tools}
// skill.body — system prompt text
// skill.hash — SHA256 content hash
```

### Drivers

Drivers execute prompts against LLM providers. Built-in support for OpenAI and Anthropic, with a registry for multi-provider setups.

```typescript
import { DriverRegistry, defineConfig } from '@tracepact/core';

const config = defineConfig({
  model: 'openai/gpt-4o',
  roles: {
    agent: 'openai/gpt-4o',
    judge: 'anthropic/claude-haiku-4-5-20251001',
    embedding: 'openai/text-embedding-3-small',
  },
});

const registry = new DriverRegistry(config);
const driver = registry.get('openai');
```

### Tool Sandbox

Mock tool environments let you test agent behavior without real side effects.

```typescript
import { createMockTools, mockReadFile, mockBash, captureWrites, denyAll, passthrough } from '@tracepact/core';

const sandbox = createMockTools({
  read_file: mockReadFile({ 'src/index.ts': 'export const x = 1;' }),
  write_file: captureWrites(),
  bash: mockBash({ 'npm test': { stdout: 'PASS' } }),
  dangerous_tool: denyAll(),
  other: passthrough(),
});

const result = await sandbox.executeTool('read_file', { path: 'src/index.ts' });
const trace = sandbox.getTrace();   // full call history
const writes = sandbox.getWrites(); // captured file writes
```

### Tool Definitions

Type-safe tool schemas using Zod:

```typescript
import { defineTools } from '@tracepact/core';
import { z } from 'zod';

const tools = defineTools({
  read_file: z.object({ path: z.string() }),
  write_file: z.object({ path: z.string(), content: z.string() }),
});
```

### Prompt Execution

The main orchestration function that ties everything together:

```typescript
import { executePrompt } from '@tracepact/core';

const result = await executePrompt('SKILL.md', {
  prompt: 'Review the code for security issues',
  sandbox,
  tools,
  config: { temperature: 0.7, maxTokens: 2048 },
});
// result.output — agent's final text response
// result.trace — complete ToolTrace
// result.usage — token counts
// result.duration — execution time in ms
```

## Assertion Matchers

TracePact provides a 5-tier matcher system, from fast deterministic checks to LLM-based evaluation:

### Tier 0 — Tool Assertions

```typescript
import { toHaveCalledTool, toHaveCalledToolsInOrder, toHaveToolCallCount } from '@tracepact/core';

toHaveCalledTool(trace, 'read_file', { path: /\.ts$/ });
toHaveCalledToolsInOrder(trace, ['read_file', 'write_file']);
toHaveToolCallCount(trace, 'read_file', 2);
toHaveFirstCalledTool(trace, 'read_file');
toHaveLastCalledTool(trace, 'write_file');
toNotHaveCalledTool(trace, 'bash');
```

### Tier 1 — Structural Assertions

```typescript
toHaveMarkdownStructure(ctx, { headings: ['## Summary'] });
toMatchJsonSchema(ctx, schema);
toHaveLineCount(ctx, { min: 5, max: 50 });
toHaveFileWritten(trace, 'output.md');
```

### Tier 2 — Content Assertions

```typescript
toContain(ctx, 'security vulnerability');
toNotContain(ctx, 'TODO');
toMention(ctx, 'eval');
toContainAll(ctx, ['injection', 'sanitize']);
toContainAny(ctx, ['warning', 'error']);
```

### Tier 3 — Semantic Assertions (async, requires embeddings)

```typescript
await toBeSemanticallySimilar(ctx, 'security analysis report', { threshold: 0.8 });
await toHaveSemanticOverlap(ctx, ['security', 'code review']);
```

### Tier 4 — Judge Assertions (async, requires LLM)

```typescript
await toPassJudge(ctx, 'Does the review identify the eval() vulnerability?');
await toMatchTrajectory(ctx, expectedTrajectory);
```

### Conditional Matchers

```typescript
import { when, calledTool, calledToolWith } from '@tracepact/core';

when(trace, calledTool('bash'), toHaveCalledTool(trace, 'read_file'));
when(trace, calledToolWith('read_file', { path: /test/ }), toNotHaveCalledTool(trace, 'bash'));
```

### RAG Assertions

```typescript
toHaveRetrievedDocument(ctx, 'doc-id');
toHaveCitedSources(ctx, ['source-1', 'source-2']);
toNotHaveHallucinated(ctx, groundTruthDocs);
```

### MCP Assertions

```typescript
toHaveCalledMcpTool(trace, 'server-name', 'tool-name');
toHaveCalledMcpServer(trace, 'server-name');
toHaveCalledMcpToolsInOrder(trace, [['server', 'tool1'], ['server', 'tool2']]);
```

## Additional Features

### Cassette Recording & Replay

Record live LLM interactions and replay them for deterministic CI:

```typescript
// Record
const result = await executePrompt('SKILL.md', {
  prompt: 'test',
  record: 'cassettes/test.json',
});

// Replay
const replayed = await executePrompt('SKILL.md', {
  prompt: 'test',
  replay: 'cassettes/test.json',
});
```

### Caching

```typescript
import { CacheStore } from '@tracepact/core';

const cache = new CacheStore({ dir: '.cache', ttlSeconds: 3600 });
```

### Redaction

Strip sensitive data before publishing results:

```typescript
import { RedactionPipeline } from '@tracepact/core';

const pipeline = new RedactionPipeline({
  rules: [{ pattern: /sk-[a-zA-Z0-9]+/g, replacement: '[REDACTED]' }],
  redactEnvValues: ['OPENAI_API_KEY'],
});

const cleaned = pipeline.redact(text);
```

### Audit

Static analysis of skill files:

```typescript
import { AuditEngine, BUILTIN_RULES } from '@tracepact/core';

const engine = new AuditEngine(BUILTIN_RULES);
const report = engine.audit(parsedSkill);
// report.findings, report.riskLevel, report.pass
```

### Model Registry

```typescript
import { listProviders, listModels, getRecommended } from '@tracepact/core';

const providers = listProviders();
const models = listModels('openai');
const recommended = getRecommended('agent');
```

## Dependencies

- `openai` — OpenAI API client
- `yaml` — YAML parsing
- `stemmer` — Text stemming for content matching

**Optional peer dependencies:**
- `@anthropic-ai/sdk` — For Anthropic provider
- `zod` — For typed tool definitions

## License

MIT
