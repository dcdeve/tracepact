# @tracepact/cli

Command-line interface for TracePact — run tests, scaffold projects, audit skills, manage cache, and more.

## Installation

```bash
npm install -g @tracepact/cli

# Or use via npx
npx tracepact
```

## Commands

### `tracepact` / `tracepact run`

Run TracePact tests via Vitest.

```bash
tracepact                          # Run tests in mock mode
tracepact --live                   # Run against real LLMs
tracepact --live --budget 50000    # Enforce token budget
tracepact --record                 # Record cassettes (implies --live)
tracepact --replay ./cassettes     # Replay from cassettes
tracepact --json                   # Output JSON results
tracepact --provider anthropic     # Use specific provider
tracepact -- --grep "security"     # Pass args through to Vitest
```

| Flag | Description |
|------|-------------|
| `--live` | Run against real LLM APIs |
| `--full` | Include expensive tests (Tier 3-4) |
| `--record` | Record cassettes from live runs |
| `--replay <dir>` | Replay from recorded cassettes |
| `--no-cache` | Skip response cache |
| `--budget <tokens>` | Abort if token usage exceeds threshold |
| `--json` | Enable JSON reporter |
| `--provider <name>` | Select provider (openai, anthropic, etc.) |
| `--health-check-strict` | Exit if provider health check fails |

### `tracepact init`

Interactive setup wizard for new projects.

```bash
tracepact init                     # Interactive wizard
tracepact init --demo              # Self-contained demo (no API keys)
tracepact init --system-prompt     # Raw system prompt template
tracepact init --skill SKILL.md    # Generate from existing skill
tracepact init --pattern api-client  # Use a pattern template
tracepact init --force             # Overwrite existing files
```

Creates `tracepact.config.ts`, `tracepact.vitest.ts`, and a test file template. The interactive wizard walks you through provider, model, and judge selection.

### `tracepact audit`

Static analysis of a SKILL.md file (no API key needed).

```bash
tracepact audit SKILL.md
tracepact audit SKILL.md --format json
tracepact audit SKILL.md --fail-on high   # Exit 1 if high+ severity found
```

Checks for:
- Risky tool combinations (e.g. bash + network)
- Prompt hygiene issues
- Skill completeness
- Opaque tool definitions

### `tracepact capture`

Auto-generate a test file from a live run or recorded cassette.

```bash
tracepact capture --skill SKILL.md --prompt "Review this code"
tracepact capture --skill SKILL.md --prompt "test" --cassette ./cassettes/run.json --dry-run
tracepact capture --skill SKILL.md --prompt "test" --out tests/generated.tracepact.ts
tracepact capture --skill SKILL.md --prompt "test" --with-semantic
```

### `tracepact cache`

Manage the response cache.

```bash
tracepact cache list               # Show cached entries
tracepact cache clear              # Delete all cache
tracepact cache clear --stale      # Delete only expired entries
tracepact cache verify             # Check cache integrity
```

### `tracepact models`

Browse the model catalog.

```bash
tracepact models                   # List all providers and models
tracepact models openai            # Show only OpenAI models
tracepact models --verbose         # Include pricing details
tracepact models --refresh         # Force refresh from models.dev
```

Shows API key status, context window, and pricing per model.

### `tracepact cost-report`

Show token usage from the last test run.

```bash
tracepact cost-report
```

Displays total tokens, API calls vs cache hits, per-provider and per-test breakdowns. Reads from `.tracepact/last-run-tokens.json`.

### `tracepact doctor`

Environment and configuration health check.

```bash
tracepact doctor
```

Checks:
- Node.js version (>=20)
- Vitest installation
- Config file presence (`tracepact.config.ts`)
- SKILL.md existence
- API keys for all known providers
- Docker/Podman runtime availability
- Cache directory writability

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TRACEPACT_LIVE` | Enable live LLM calls (`1` to enable) |
| `TRACEPACT_FULL` | Enable expensive tests (`1` to enable) |
| `TRACEPACT_PROVIDER` | Default provider name |
| `TRACEPACT_BUDGET` | Max token budget |
| `TRACEPACT_RECORD` | Enable cassette recording |
| `TRACEPACT_REPLAY` | Path to cassette directory for replay |
| `TRACEPACT_NO_CACHE` | Disable response caching |

## License

MIT
