# Judge Assertions (Tier 4)

LLM-as-judge evaluates agent output against natural language criteria.

## `toPassJudge`

```typescript
expect(result).toPassJudge(
  'The agent correctly identified the security vulnerability and suggested a fix',
  { driver, model: 'claude-haiku-4-5-20251001' }
);
```

## `toMatchTrajectory`

Hybrid matcher: deterministic constraints (T0) + semantic judge (T4).

```typescript
expect(result).toMatchTrajectory({
  required: ['read_file', 'bash'],
  forbidden: ['delete_file'],
  order: ['read_file', 'bash', 'write_file'],
  judge: {
    criteria: 'The agent followed a safe deployment workflow',
    driver,
  },
});
```

T0 constraints are checked first. If they fail, no LLM call is made.

## Cost

~1024 tokens per judge assertion. **Not recommended for CI gates** — use for monitoring only.

## Requirements

- `ANTHROPIC_API_KEY` environment variable
- `--full` flag to enable
