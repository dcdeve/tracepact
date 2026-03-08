# @tracepact/vitest

## 0.5.0

### Patch Changes

- [#8](https://github.com/dcdeve/tracepact/pull/8) [`2cb89c0`](https://github.com/dcdeve/tracepact/commit/2cb89c0c8d0313cabecd72541a210d79f612418b) Thanks [@dcdeve](https://github.com/dcdeve)! - fix: QA findings — TraceBuilder chaining, matcher compatibility, docs

  - `TraceBuilder.addCall()` now returns `this` for method chaining, plus a shorthand overload `addCall(name, args, result)`
  - `toHaveFileWritten()` accepts both `WriteCapture[]` and `ToolTrace` (extracts writes from trace automatically)
  - `toMatchJsonSchema()` uses `safeParse` for Zod compatibility, with `parse` fallback
  - Fixed README record/replay example (wrong params) and install command (missing `@tracepact/cli`)
  - Documented conditional matchers, `toMention` stem option, and `runSkill` mock-mode behavior

- Updated dependencies [[`cab259c`](https://github.com/dcdeve/tracepact/commit/cab259c97cdd97d1d1712743ae8bcddd23a79c3b), [`2cb89c0`](https://github.com/dcdeve/tracepact/commit/2cb89c0c8d0313cabecd72541a210d79f612418b)]:
  - @tracepact/core@0.5.0

## 0.4.0

### Minor Changes

- fix: streaming tool calls, capture schemas, cache enabled, glob matching

  - BUG-010: OpenAI streaming now includes `type: "function"` in tool call messages
  - BUG-011: `tracepact capture` generates valid schemas for frontmatter tools
  - BUG-012: CacheStore respects `enabled: false` (no reads or writes)
  - BUG-013: Glob `**/*.ext` matches files in root directory
  - Added documentation: gotchas section in llms-full.txt, glob patterns guide, capture notes

### Patch Changes

- Updated dependencies []:
  - @tracepact/core@0.4.0

## 0.3.5

### Patch Changes

- [`db4f59c`](https://github.com/dcdeve/tracepact/commit/db4f59ce719c00208e190329178e24ea22f01f9e) Thanks [@dcdeve](https://github.com/dcdeve)! - fix: make defineTools compatible with zod v3 and v4, accept raw JSON schemas

  - zodToJsonSchema now handles both zod v3 (shape as function) and v4 (shape as object)
  - Try zod v4's built-in toJSONSchema() when available
  - Accept plain JSON schema objects as alternative to zod schemas in defineTools
  - Add support for ZodDefault and ZodNullable types
  - runSkill() now warns when called without TRACEPACT_LIVE or replay
  - driver.run() validates RunInput.skill with clear error message

- Updated dependencies [[`db4f59c`](https://github.com/dcdeve/tracepact/commit/db4f59ce719c00208e190329178e24ea22f01f9e)]:
  - @tracepact/core@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies []:
  - @tracepact/core@0.3.4

## 0.3.3

### Patch Changes

- Updated dependencies [[`9172f0c`](https://github.com/dcdeve/tracepact/commit/9172f0cff1394ac6062a017cd1bfa3b34749d93c)]:
  - @tracepact/core@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies [[`5d3f633`](https://github.com/dcdeve/tracepact/commit/5d3f633e431c0f902f7bb3e96182b614a655f0fa)]:
  - @tracepact/core@0.3.2

## 0.3.1

### Patch Changes

- [`e746bbd`](https://github.com/dcdeve/tracepact/commit/e746bbde317f4bfed34216772a87b14a92c2b1c5) Thanks [@dcdeve](https://github.com/dcdeve)! - Fix biome lint issues, normalize package.json metadata, fix init wizard argument bug.

- Updated dependencies [[`e746bbd`](https://github.com/dcdeve/tracepact/commit/e746bbde317f4bfed34216772a87b14a92c2b1c5)]:
  - @tracepact/core@0.3.1
