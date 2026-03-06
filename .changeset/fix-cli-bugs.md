---
"@tracepact/core": patch
"@tracepact/cli": patch
---

fix: resolve critical CLI bugs from first user feedback

- BUG-001: Remove duplicate shebang in CLI dist (was causing SyntaxError)
- BUG-002: `init --demo` now generates package.json with "type": "module" and tsconfig.json
- BUG-003: Replace process.exit() with process.exitCode to prevent output duplication
- BUG-004: Allow `defineConfig({})` without provider for mock-only mode
- BUG-005: `doctor` now shows warning instead of critical failure for missing config
