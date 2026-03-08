# @tracepact/mcp-server

## 0.5.0

### Minor Changes

- [#19](https://github.com/dcdeve/tracepact/pull/19) [`cab259c`](https://github.com/dcdeve/tracepact/commit/cab259c97cdd97d1d1712743ae8bcddd23a79c3b) Thanks [@dcdeve](https://github.com/dcdeve)! - feat: diff policy and severity levels for CI gating

  - `DiffPolicy`: `ignoreKeys` and `ignoreTools` to filter noisy args and tools from comparison
  - `DiffSeverity`: `none | warn | block` based on change type (arg change vs structural)
  - CLI: `--fail-on warn|block`, `--ignore-keys`, `--ignore-tools` flags
  - MCP server: `ignore_keys`/`ignore_tools` params on `tracepact_diff`

### Patch Changes

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
