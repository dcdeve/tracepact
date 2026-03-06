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
| `toMatchJsonSchema(schema)` | Output matches JSON schema |
| `toHaveLineCount(n)` | Output has expected line count |
| `toHaveFileWritten(path)` | Agent wrote to this file path |

## Tier 2 — Content Assertions

| Matcher | Description |
|---------|-------------|
| `toContain(text)` | Output contains text |
| `toNotContain(text)` | Output does not contain text |
| `toMention(term)` | Output mentions term (stemmed) |
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

```typescript
import { when, calledTool } from '@tracepact/core';

// Only assert if the tool was actually called
when(result.trace, calledTool('bash'),
  toHaveCalledTool(result, 'write_file'));
```
