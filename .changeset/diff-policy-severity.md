---
"@tracepact/core": minor
"@tracepact/cli": minor
"@tracepact/mcp-server": minor
---

feat: diff policy and severity levels for CI gating

- `DiffPolicy`: `ignoreKeys` and `ignoreTools` to filter noisy args and tools from comparison
- `DiffSeverity`: `none | warn | block` based on change type (arg change vs structural)
- CLI: `--fail-on warn|block`, `--ignore-keys`, `--ignore-tools` flags
- MCP server: `ignore_keys`/`ignore_tools` params on `tracepact_diff`
