# @tracepact/core

## 0.4.0

### Minor Changes

- fix: streaming tool calls, capture schemas, cache enabled, glob matching

  - BUG-010: OpenAI streaming now includes `type: "function"` in tool call messages
  - BUG-011: `tracepact capture` generates valid schemas for frontmatter tools
  - BUG-012: CacheStore respects `enabled: false` (no reads or writes)
  - BUG-013: Glob `**/*.ext` matches files in root directory
  - Added documentation: gotchas section in llms-full.txt, glob patterns guide, capture notes

## 0.3.5

### Patch Changes

- [`db4f59c`](https://github.com/dcdeve/tracepact/commit/db4f59ce719c00208e190329178e24ea22f01f9e) Thanks [@dcdeve](https://github.com/dcdeve)! - fix: make defineTools compatible with zod v3 and v4, accept raw JSON schemas

  - zodToJsonSchema now handles both zod v3 (shape as function) and v4 (shape as object)
  - Try zod v4's built-in toJSONSchema() when available
  - Accept plain JSON schema objects as alternative to zod schemas in defineTools
  - Add support for ZodDefault and ZodNullable types
  - runSkill() now warns when called without TRACEPACT_LIVE or replay
  - driver.run() validates RunInput.skill with clear error message

## 0.3.4

## 0.3.3

### Patch Changes

- [`9172f0c`](https://github.com/dcdeve/tracepact/commit/9172f0cff1394ac6062a017cd1bfa3b34749d93c) Thanks [@dcdeve](https://github.com/dcdeve)! - docs: complete documentation for providers, audit rules, and skills.sh integration

  - Document mock-only mode (defineConfig without provider)
  - Add providers/presets table with OpenAI/Anthropic native SDK note
  - Document audit rule naming convention (kebab-case vs camelCase)
  - Add skills.sh fields to KNOWN_FRONTMATTER_FIELDS (no more warnings for version, license, metadata, user-invocable)
  - Add skills.sh integration guide
  - Fix npx tracepact references to npx @tracepact/cli in quick-start

## 0.3.2

### Patch Changes

- [#2](https://github.com/dcdeve/tracepact/pull/2) [`5d3f633`](https://github.com/dcdeve/tracepact/commit/5d3f633e431c0f902f7bb3e96182b614a655f0fa) Thanks [@dcdeve](https://github.com/dcdeve)! - fix: resolve critical CLI bugs from first user feedback

  - BUG-001: Remove duplicate shebang in CLI dist (was causing SyntaxError)
  - BUG-002: `init --demo` now generates package.json with "type": "module" and tsconfig.json
  - BUG-003: Replace process.exit() with process.exitCode to prevent output duplication
  - BUG-004: Allow `defineConfig({})` without provider for mock-only mode
  - BUG-005: `doctor` now shows warning instead of critical failure for missing config

## 0.3.1

### Patch Changes

- [`e746bbd`](https://github.com/dcdeve/tracepact/commit/e746bbde317f4bfed34216772a87b14a92c2b1c5) Thanks [@dcdeve](https://github.com/dcdeve)! - Fix biome lint issues, normalize package.json metadata, fix init wizard argument bug.
