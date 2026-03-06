# @tracepact/cli

## 0.3.2

### Patch Changes

- [#2](https://github.com/dcdeve/tracepact/pull/2) [`5d3f633`](https://github.com/dcdeve/tracepact/commit/5d3f633e431c0f902f7bb3e96182b614a655f0fa) Thanks [@dcdeve](https://github.com/dcdeve)! - fix: resolve critical CLI bugs from first user feedback

  - BUG-001: Remove duplicate shebang in CLI dist (was causing SyntaxError)
  - BUG-002: `init --demo` now generates package.json with "type": "module" and tsconfig.json
  - BUG-003: Replace process.exit() with process.exitCode to prevent output duplication
  - BUG-004: Allow `defineConfig({})` without provider for mock-only mode
  - BUG-005: `doctor` now shows warning instead of critical failure for missing config

- Updated dependencies [[`5d3f633`](https://github.com/dcdeve/tracepact/commit/5d3f633e431c0f902f7bb3e96182b614a655f0fa)]:
  - @tracepact/core@0.3.2

## 0.3.1

### Patch Changes

- [`e746bbd`](https://github.com/dcdeve/tracepact/commit/e746bbde317f4bfed34216772a87b14a92c2b1c5) Thanks [@dcdeve](https://github.com/dcdeve)! - Fix biome lint issues, normalize package.json metadata, fix init wizard argument bug.

- Updated dependencies [[`e746bbd`](https://github.com/dcdeve/tracepact/commit/e746bbde317f4bfed34216772a87b14a92c2b1c5)]:
  - @tracepact/core@0.3.1
