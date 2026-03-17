# CLI Reference

## Commands

```bash
tracepact                     # run tests (default)
tracepact run                 # explicit run
tracepact init                # interactive setup wizard
tracepact init --demo         # scaffold demo project
tracepact models              # browse available models and providers
tracepact audit <skill-path>  # static analysis of SKILL.md
tracepact capture             # generate test from cassette
tracepact cache list|clear|verify  # manage cache
tracepact cost-report         # show token usage from last run
tracepact doctor              # check environment
```

## Run Options

```bash
tracepact --live                   # include live API tests
tracepact --full                   # include expensive (Tier 3-4)
tracepact --provider openai        # select provider
tracepact --budget 50000           # token budget limit
tracepact --json                   # JSON reporter
tracepact --record                 # record cassettes (implies --live)
tracepact --replay <dir>           # replay from cassettes
tracepact --no-cache               # skip response cache
tracepact --health-check-strict    # exit if provider health check fails
```

## Init

Interactive wizard (default) or non-interactive with flags:

```bash
tracepact init                               # interactive: provider, model, judge, embedding
tracepact init --demo                        # self-contained demo suite
tracepact init --skill ./SKILL.md            # generate from SKILL.md
tracepact init --system-prompt               # raw system prompt agent
tracepact init --pattern api-client          # API client pattern template
tracepact init --pattern data-transformer    # data transformer pattern template
tracepact init --force                       # overwrite existing files
```

## Models

Browse the model catalog (fetched from models.dev with local cache):

```bash
tracepact models                   # list all providers and models
tracepact models anthropic         # filter by provider
tracepact models --verbose         # show pricing ($input/$output per 1M tokens)
tracepact models --refresh         # force refresh from models.dev
```

## Capture

```bash
tracepact capture \
  --skill ./SKILL.md \
  --prompt "deploy the app" \
  --cassette ./cassettes/deploy.json \
  --out ./tests/deploy.test.ts \
  --provider anthropic \
  --with-semantic \
  --dry-run
```

## Diff

Compare two cassettes and show behavioral differences:

```bash
tracepact diff <cassette-a> <cassette-b>
tracepact diff cassettes/v1.json cassettes/v2.json --json
tracepact diff cassettes/v1.json cassettes/v2.json --exit-on-change
tracepact diff cassettes/v1.json cassettes/v2.json --fail-on warn
tracepact diff cassettes/v1.json cassettes/v2.json --ignore-keys timestamp,requestId
tracepact diff cassettes/v1.json cassettes/v2.json --ignore-tools read_file,list_dir
```

## Cache

```bash
tracepact cache list    # show cached entries
tracepact cache clear   # delete all cache entries
tracepact cache clear --stale   # delete only expired entries
tracepact cache verify  # check cache integrity
```

## Audit Rules

The `audit` command runs four built-in rules against SKILL.md files:

| Rule name | Export name | What it checks |
|-----------|------------|----------------|
| `tool-combo-risk` | `toolComboRisk` | Dangerous tool combinations (e.g. bash + write_file) |
| `prompt-hygiene` | `promptHygiene` | Prompt injection patterns and unsafe instructions |
| `skill-completeness` | `skillCompleteness` | Recommended frontmatter fields (name, description, triggers, tools, excludes) |
| `no-opaque-tools` | `noOpaqueTools` | Tools declared without clear descriptions |

> **Naming convention:** Rule names use `kebab-case` in reports and JSON output. The corresponding TypeScript exports use `camelCase`. When searching for a finding from a report in code, convert kebab-case to camelCase (e.g. `tool-combo-risk` -> `toolComboRisk`).

The `skill-completeness` rule checks for fields from the TracePact SKILL.md format. Skills from other ecosystems (like skills.sh) may not have `triggers`, `tools`, or `excludes` — these findings can be safely ignored or suppressed with `--fail-on` to only fail on higher severity issues:

```bash
tracepact audit SKILL.md --fail-on high   # ignore medium/low findings
```

## Notes

### Capture with frontmatter tools

`tracepact capture` auto-generates permissive tool schemas from tool names declared in the SKILL.md `tools:` frontmatter. These schemas accept any JSON object — they exist only to tell the LLM that tools are available. If you need strict parameter validation, define explicit schemas in your test files using `defineTools`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests pass |
| 1 | Test failure or error |
| 2 | Configuration error |
