# Mock vs Live Testing

## Mock Mode (default)

Tests run offline using `MockDriver` and `MockSandbox`. No API keys needed.

```typescript
const result = await runSkill(skill, {
  prompt: 'deploy',
  replay: './cassettes/deploy.json', // recorded behavior
});
```

## Live Mode

Tests call real LLM APIs. Enable with `--live`:

```bash
npx tracepact --live
```

Or in code:

```typescript
test.live('agent handles edge case', async () => {
  // Only runs with --live flag
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
