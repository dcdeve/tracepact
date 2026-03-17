# Assertions Reference

## Tier 0 — Tool Call Assertions

| Matcher | Description |
|---------|-------------|
| `toHaveCalledTool(name)` | Tool was called at least once |
| `toHaveCalledTool(name, args)` | Tool called with matching args |
| `toNotHaveCalledTool(name)` | Tool was never called |
| `toHaveCalledToolsInOrder([...])` | Tools called in relative order |
| `toHaveCalledToolsInStrictOrder([...])` | Tools called in exact sequence |
| `toHaveToolCallCount(n)` | Exact number of tool calls |
| `toHaveFirstCalledTool(name)` | First tool call was this tool |
| `toHaveLastCalledTool(name)` | Last tool call was this tool |

## Tier 1 — Structural Assertions

| Matcher | Description |
|---------|-------------|
| `toHaveMarkdownStructure(config)` | Output has expected markdown headings |
| `toMatchJsonSchema(schema)` | Output matches JSON schema (accepts Zod schemas or any object with `.safeParse()`) |
| `toHaveLineCount(n)` | Output has expected line count |
| `toHaveFileWritten(path)` | Agent wrote to this file path |

## Tier 2 — Content Assertions

| Matcher | Description |
|---------|-------------|
| `toContain(text)` | Output contains text |
| `toNotContain(text)` | Output does not contain text |
| `toMention(term, opts?)` | Output mentions term (exact match by default; pass `{ stem: true }` for stemmed matching) |
| `toContainAll([...])` | Output contains all terms |
| `toContainAny([...])` | Output contains at least one term |

## Tier 3 — Semantic Assertions

| Matcher | Description |
|---------|-------------|
| `toBeSemanticallySimilar(text, opts?)` | Embedding similarity above threshold |
| `toHaveSemanticOverlap(text, opts?)` | Semantic overlap between outputs |

Requires `OPENAI_API_KEY` for embedding calls.

## Tier 4 — Judge Assertions

| Matcher | Description |
|---------|-------------|
| `toPassJudge(criteria, opts?)` | LLM judge evaluates output against criteria |
| `toMatchTrajectory(config)` | Hybrid T0+T4 trajectory validation |

## Conditional Matchers

Guard assertions so they only run when a condition is met:

```typescript
import { when, calledTool, calledToolWith, calledToolAfter, calledToolTimes } from '@tracepact/core';

// Only assert if the tool was actually called
when(result.trace, calledTool('bash'),
  toHaveCalledTool(result.trace, 'write_file'));

// Only assert if tool was called with specific args
when(result.trace, calledToolWith('read_file', { path: 'config.json' }),
  toHaveCalledTool(result.trace, 'write_file'));

// Only assert if tools were called in order
when(result.trace, calledToolAfter('read_file', 'write_file'),
  toHaveCalledTool(result.trace, 'bash'));

// Only assert if tool was called exactly N times
when(result.trace, calledToolTimes('bash', 2),
  toHaveCalledTool(result.trace, 'write_file'));
```

| Condition | Description |
|-----------|-------------|
| `calledTool(name)` | True if tool was called at least once |
| `calledToolWith(name, args)` | True if tool was called with matching args |
| `calledToolAfter(first, second)` | True if `second` was called after `first` |
| `calledToolTimes(name, n)` | True if tool was called exactly `n` times |
