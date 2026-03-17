# Quick Start

## Install

```bash
npm install -D @tracepact/core @tracepact/vitest
```

## Setup

```bash
# Interactive wizard — picks provider, models, generates config
npx @tracepact/cli init

# Or scaffold a quick demo (no API key needed)
npx @tracepact/cli init --demo
```

The `--demo` flag generates a complete project: `package.json`, `tsconfig.json`, `tracepact.config.ts`, `tracepact.vitest.ts`, and a demo test file. Run `npm install && npm test` to see it work.

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

  expect(result.trace).toHaveCalledTool('read_file');
  expect(result.trace).toHaveCalledTool('bash');
  expect(result.trace).toHaveCalledToolsInOrder(['read_file', 'bash']);
});
```

## Run

```bash
npx @tracepact/cli
```

> **Tip:** If you have `@tracepact/cli` installed locally (via `npm install -D @tracepact/cli`), you can use `npx tracepact` directly.

## Browse available models

```bash
npx @tracepact/cli models                   # all providers
npx @tracepact/cli models anthropic         # filter by provider
npx @tracepact/cli models --verbose         # show pricing
```

## Next Steps

- [IDE Setup (MCP)](/guide/ide-setup) — let your AI generate tests automatically
- [Mock vs Live](/guide/mock-vs-live) — testing without API calls
- [Assertions Reference](/reference/assertions) — all 30+ matchers
- [Configuration Reference](/reference/configuration) — model shorthand, roles, providers
