# Cassettes — Record & Replay

Record agent behavior as JSON cassettes. Replay deterministically in CI.

## Record

```bash
npx tracepact --record --live
```

Or in code:

```typescript
const result = await runSkill(skill, {
  prompt: 'deploy to staging',
  record: './cassettes/deploy.json',
});
```

## Replay

```typescript
const result = await runSkill(skill, {
  prompt: 'deploy to staging',
  replay: './cassettes/deploy.json',
});
```

## Step-Level Stubs

Override specific tool results in a replay:

```typescript
const result = await runSkill(skill, {
  prompt: 'deploy to staging',
  replay: './cassettes/deploy.json',
  stubs: [{
    at: { sequenceIndex: 1, toolName: 'bash' },
    return: { type: 'error', message: 'npm test failed' },
  }],
});
```

## Cassette Format

```json
{
  "version": 1,
  "recordedAt": "2026-03-06T12:00:00Z",
  "metadata": {
    "skillHash": "...",
    "prompt": "deploy to staging",
    "promptHash": "...",
    "toolDefsHash": "...",
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0,
    "frameworkVersion": "...",
    "driverVersion": "..."
  },
  "result": {
    "output": "...",
    "trace": { "calls": [...], "totalCalls": 3, "totalDurationMs": 1200 },
    "messages": [...],
    "usage": { "inputTokens": 850, "outputTokens": 120, "model": "gpt-4o", "modelVersion": "gpt-4o-2024-08-06" },
    "duration": 3400
  }
}
```
