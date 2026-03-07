# Contributing to TracePact

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Adding a Matcher](#adding-a-matcher)
- [Adding a CLI Command](#adding-a-cli-command)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

- **Node.js** >= 20 (see `.nvmrc`)
- **npm** >= 10
- **Docker** (optional, for container sandbox tests)

### Getting Started

```bash
git clone https://github.com/dcdeve/tracepact.git
cd tracepact
npm install
npm run build
npm test
```

### Verify Everything Works

```bash
npm run typecheck   # TypeScript type checking
npm run lint        # Biome linter
npm test            # All tests across all packages
```

## Project Structure

This is a monorepo with npm workspaces. All packages live under `packages/`:

```
packages/
  core/          @tracepact/core        — Engine: matchers, sandbox, drivers, cache, audit
  vitest/        @tracepact/vitest      — Vitest plugin and matcher registration
  cli/           @tracepact/cli         — CLI commands
  promptfoo/     @tracepact/promptfoo   — Promptfoo eval integration
  mcp-server/    @tracepact/mcp-server  — MCP server for IDE integration
```

**Dependency direction:** all packages depend on `core`. No circular dependencies.

```
cli ──→ core
vitest ──→ core
promptfoo ──→ core
mcp-server ──→ core
```

### Key Directories in Core

```
packages/core/src/
  matchers/
    tier0/     Tool call assertions (toHaveCalledTool, etc.)
    tier1/     Structural assertions (toHaveMarkdownStructure, etc.)
    tier2/     Content assertions (toContain, toMention, etc.)
    tier3/     Semantic assertions (toBeSemanticallySimilar, etc.)
    tier4/     Judge assertions (toPassJudge)
    rag/       RAG-specific matchers
    mcp/       MCP tool call matchers
    utils/     Shared utilities (stemmer, tokenizer, JSON extractor)
  sandbox/     MockSandbox, ContainerSandbox, MCP mock
  driver/      LLM drivers (OpenAI-compatible)
  audit/       Static analysis engine
  cache/       Response cache with TTL
  cassette/    Record & replay
```

## Development Workflow

### Building

```bash
# Build all packages
npm run build

# Build a specific package
npm run build -w packages/core
```

All packages use [tsup](https://tsup.egoist.dev/) for building.

### Running Tests

```bash
# All packages
npm test

# Specific package
npm test -w packages/core

# Watch mode
npx vitest -w packages/core
```

### Linting

We use [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check
npm run lint

# Auto-fix
npm run lint:fix
```

### Type Checking

```bash
npm run typecheck
```

## Coding Standards

### TypeScript

- Strict mode enabled
- Prefer `type` over `interface` for object shapes
- Use explicit return types on exported functions
- No `any` — use `unknown` and narrow

### Style (enforced by Biome)

- Tabs for indentation
- Double quotes for strings
- Trailing commas
- No unused imports

### File Naming

- Source files: `kebab-case.ts`
- Test files: `kebab-case.test.ts`
- Skill test files: `*.tracepact.ts`

### Exports

Every package has a single `src/index.ts` entry point. Export everything the consumer needs from there.

## Testing

### Test Organization

Tests live next to the code they test:

```
packages/core/src/matchers/tier0/
  tool-assertions.ts
  tool-assertions.test.ts
```

### Writing Tests

```typescript
import { describe, expect, test } from 'vitest';

describe('toHaveCalledTool', () => {
  test('passes when tool was called with matching args', () => {
    // Arrange
    const trace = new TraceBuilder()
      .addCall('read_file', { path: 'a.ts' }, 'content')
      .build();

    // Act & Assert
    const result = toHaveCalledTool(trace, 'read_file', { path: 'a.ts' });
    expect(result.pass).toBe(true);
  });
});
```

### Test Categories

- **Unit tests** — Run with `npm test`, no API keys needed
- **Live tests** — Wrapped in `test.live()`, require `TRACEPACT_LIVE=1` and API keys
- **Expensive tests** — Wrapped in `test.expensive()`, require `--full` flag

### Running Specific Tests

```bash
# By file
npx vitest packages/core/src/matchers/tier0/tool-assertions.test.ts

# By name
npx vitest -t "toHaveCalledTool"
```

## Submitting Changes

### Branch Naming

```
feat/add-new-matcher
fix/cache-ttl-bug
docs/update-readme
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add toHaveCalledToolBefore matcher
fix: cache TTL not respecting timezone
docs: add cassette recording guide
test: add edge cases for MCP matchers
chore: update tsup to v9
```

### Branch Flow

```
feature/my-change  →  PR to develop  →  PR to main  →  release
```

- **`main`** — stable, releases are cut from here. Protected: requires PR + CI + review.
- **`develop`** — integration branch. Protected: requires PR + CI + review.
- **Feature branches** — branch from `develop`, PR back to `develop`.

### Pull Request Process

1. **Create a branch** from `develop`
2. **Make your changes** with tests
3. **Add a changeset** describing your changes:
   ```bash
   npx changeset
   ```
   This will interactively ask:
   - Which packages changed?
   - Is it a patch, minor, or major change?
   - A summary of the change

4. **Ensure CI passes:**
   ```bash
   make ci   # or: npm run lint && npm run typecheck && npm run build && npm test
   ```

5. **Open a PR** against `develop`
6. Once `develop` is stable, a maintainer opens a PR from `develop` → `main` to release

### Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning. Every PR that changes user-facing behavior needs a changeset.

**When to add a changeset:**
- New feature or matcher
- Bug fix
- Breaking change
- New CLI command

**When NOT to add a changeset:**
- Internal refactoring with no API changes
- Test-only changes
- Documentation-only changes

## Adding a Matcher

Matchers are the core of TracePact. Here's how to add a new one:

### 1. Implement the Matcher Function

Create or edit a file in the appropriate tier directory:

```typescript
// packages/core/src/matchers/tier0/my-matcher.ts
import type { MatcherResult, ToolTrace } from '../../types.js';

export function toHaveMyBehavior(
  trace: ToolTrace,
  expected: string,
): MatcherResult {
  const pass = /* your logic */;
  return {
    pass,
    message: pass
      ? `Expected trace NOT to have behavior "${expected}"`
      : `Expected trace to have behavior "${expected}"`,
  };
}
```

### 2. Export from Core

```typescript
// packages/core/src/index.ts
export { toHaveMyBehavior } from './matchers/tier0/my-matcher.js';
```

### 3. Register in Vitest

```typescript
// packages/vitest/src/matchers.ts — add to the extend() call
toHaveMyBehavior(trace: ToolTrace, expected: string) {
  return toHaveMyBehaviorFn(trace, expected);
},
```

### 4. Add Type Augmentation

```typescript
// packages/vitest/src/augment.d.ts
interface CustomMatchers<R> {
  toHaveMyBehavior(expected: string): R;
}
```

### 5. Write Tests

```typescript
// packages/core/src/matchers/tier0/my-matcher.test.ts
describe('toHaveMyBehavior', () => {
  test('passes when behavior is present', () => { /* ... */ });
  test('fails when behavior is absent', () => { /* ... */ });
  test('message describes the failure clearly', () => { /* ... */ });
});
```

## Adding a CLI Command

### 1. Create the Command

```typescript
// packages/cli/src/commands/my-command.ts
export async function myCommand(args: string[]): Promise<void> {
  // Implementation
}
```

### 2. Register in the CLI Router

Add your command to the main CLI entry point in `packages/cli/src/index.ts`.

### 3. Write Tests

Test the command function directly (not via process spawning):

```typescript
// packages/cli/src/commands/my-command.test.ts
describe('my-command', () => {
  test('produces expected output', async () => {
    // ...
  });
});
```

## Release Process

Releases are automated via [Changesets](https://github.com/changesets/changesets) and GitHub Actions.

### How It Works

1. Contributors add changesets with their PRs (`npx changeset`)
2. When changesets accumulate on `main`, the CI creates a "Version Packages" PR
3. That PR bumps versions, updates CHANGELOGs, and removes consumed changesets
4. When merged, CI publishes all changed packages to npm

### Version Groups

`core`, `vitest`, `cli`, and `mcp-server` are **version-locked** — they always release together with the same version number. `promptfoo` is versioned independently.

### Manual Release (maintainers)

```bash
npm run version    # Apply changesets → bump versions + changelogs
npm run release    # Build + publish to npm
```

## Getting Help

- **Issues:** [github.com/dcdeve/tracepact/issues](https://github.com/dcdeve/tracepact/issues)
- **Discussions:** [github.com/dcdeve/tracepact/discussions](https://github.com/dcdeve/tracepact/discussions)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold a welcoming and inclusive environment.
