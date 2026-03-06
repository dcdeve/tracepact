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
tracepact cache list|clear    # manage cache
tracepact cost-report         # show token usage from last run
tracepact doctor              # check environment
```

## Run Options

```bash
tracepact --live              # include live API tests
tracepact --full              # include expensive (Tier 3-4)
tracepact --provider openai   # select provider
tracepact --budget 50000      # token budget limit
tracepact --json              # JSON reporter
tracepact --record            # record cassettes (implies --live)
tracepact --replay <dir>      # replay from cassettes
tracepact --no-cache          # skip response cache
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
  --dry-run
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests pass |
| 1 | Test failure or error |
| 2 | Configuration error |
| 3 | Budget exceeded |
| 4 | Provider unreachable |
