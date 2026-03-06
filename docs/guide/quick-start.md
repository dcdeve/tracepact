# Quick Start

## Install

```bash
npm install -D @tracepact/core @tracepact/vitest
```

## Setup

```bash
# Interactive wizard — picks provider, models, generates config
npx tracepact init

# Or scaffold a quick demo (no API key needed)
npx tracepact init --demo
```

The interactive wizard guides you through:
1. Project type (SKILL.md agent, system prompt, pattern template, demo)
2. Provider selection (shows which providers have API keys configured)
3. Agent model selection (for live tests)
4. Judge model selection (cheap model for `toPassJudge` assertions)
5. Embedding model selection (for semantic assertions)

## Write your first test

```typescript
import { expect, test } from 'vitest';
import { runSkill, parseSkill } from '@tracepact/vitest';

test('agent reads config before deploying', async () => {
  const skill = await parseSkill('./SKILL.md');
  const result = await runSkill(skill, {
    prompt: 'deploy to staging',
    replay: './cassettes/deploy.json',
  });

  expect(result).toHaveCalledTool('read_file');
  expect(result).toHaveCalledTool('bash');
  expect(result).toHaveCalledToolsInOrder(['read_file', 'bash']);
});
```

## Run

```bash
npx tracepact
```

## Browse available models

```bash
npx tracepact models                   # all providers
npx tracepact models anthropic         # filter by provider
npx tracepact models --verbose         # show pricing
```

## Next Steps

- [IDE Setup (MCP)](/guide/ide-setup) — let your AI generate tests automatically
- [Mock vs Live](/guide/mock-vs-live) — testing without API calls
- [Assertions Reference](/reference/assertions) — all 30+ matchers
- [Configuration Reference](/reference/configuration) — model shorthand, roles, providers
