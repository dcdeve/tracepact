# Using TracePact with skills.sh

[skills.sh](https://skills.sh) is the largest ecosystem of AI agent skills (400K+ installs). TracePact can parse and test skills.sh SKILLs out of the box, with a few caveats documented here.

## Parsing skills.sh SKILLs

TracePact's `parseSkill()` reads any SKILL.md file with YAML frontmatter. The only required field is `name`.

skills.sh SKILLs often include extra frontmatter fields like `license`, `metadata`, `version`, and `user-invocable`. TracePact recognizes these fields from skills.sh and will **not** generate warnings for them.

### Recognized frontmatter fields

**TracePact native fields:**
- `name` (required)
- `description`
- `triggers`
- `excludes`
- `tools`

**skills.sh fields (accepted without warnings):**
- `version`
- `license`
- `metadata`
- `user-invocable`

Any other field will produce a warning: `Unknown frontmatter field: "X". This may be intentional (forward compatibility).` These warnings are informational and do not affect parsing.

## Running audit on skills.sh SKILLs

```bash
tracepact audit path/to/SKILL.md
```

The `skill-completeness` audit rule checks for TracePact-specific fields (`triggers`, `tools`, `excludes`) that skills.sh SKILLs typically don't include. This produces medium/low severity findings that you can safely ignore.

To only fail on critical issues:

```bash
tracepact audit SKILL.md --fail-on high
```

To get JSON output for CI filtering:

```bash
tracepact audit SKILL.md --format json
```

## Testing skills.sh SKILLs with mock tools

```typescript
import { describe, expect, test } from 'vitest';
import { createMockTools, mockReadFile, parseSkill, denyAll } from '@tracepact/vitest';

const skill = await parseSkill('./SKILL.md');

const sandbox = createMockTools({
  read_file: mockReadFile({
    'src/index.ts': 'export const main = () => "hello";',
  }),
  bash: denyAll(),
});

describe(skill.frontmatter.name, () => {
  test('skill parsed successfully', () => {
    expect(skill.parseWarnings).toHaveLength(0);
    expect(skill.frontmatter.name).toBeDefined();
  });

  test('reads source files', async () => {
    const result = await sandbox.executeTool('read_file', { path: 'src/index.ts' });
    expect(result.type).toBe('success');
  });

  test('denies bash execution', async () => {
    const result = await sandbox.executeTool('bash', { command: 'rm -rf /' });
    expect(result.type).toBe('error');
  });
});
```

## Example: testing a Vercel deploy skill

```typescript
import { describe, expect, test } from 'vitest';
import { createMockTools, mockReadFile, denyAll } from '@tracepact/vitest';

const sandbox = createMockTools({
  read_file: mockReadFile({
    'vercel.json': '{ "version": 2 }',
    'package.json': '{ "scripts": { "build": "next build" } }',
  }),
  bash: (args) => {
    const cmd = String(args.command ?? '');
    if (cmd.startsWith('vercel deploy')) {
      return { type: 'success', content: 'Deployed to https://my-app.vercel.app' };
    }
    return { type: 'error', message: `Command not allowed: ${cmd}` };
  },
  write_file: denyAll(),
});

describe('deploy-to-vercel skill', () => {
  test('reads config before deploying', async () => {
    await sandbox.executeTool('read_file', { path: 'vercel.json' });
    await sandbox.executeTool('bash', { command: 'vercel deploy --prod' });

    const trace = sandbox.getTrace();
    expect(trace.calls[0]?.toolName).toBe('read_file');
    expect(trace.calls[1]?.toolName).toBe('bash');
  });
});
```

## Config for mock-only testing

skills.sh SKILLs can be tested without any API keys or provider configuration:

```typescript
// tracepact.config.ts
import { defineConfig } from '@tracepact/core';

export default defineConfig({});
```

For live testing against a real LLM, add a model:

```typescript
export default defineConfig({
  skill: './SKILL.md',
  model: 'anthropic/claude-sonnet-4-5-20250929',
});
```
