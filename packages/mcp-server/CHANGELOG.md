# @tracepact/mcp-server

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
