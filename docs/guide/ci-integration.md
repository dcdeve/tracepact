# CI Integration

## GitHub Action

```yaml
# .github/workflows/agent-tests.yml
name: Agent Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/tracepact
        with:
          live: ${{ github.ref == 'refs/heads/main' }}
          budget: "100000"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Manual CI Setup

```bash
npm install -D @tracepact/core @tracepact/vitest @tracepact/cli
npx tracepact run --json
```

Results are written to `.tracepact/results.json` and `.tracepact/last-run-tokens.json`.

## Cost Control

```bash
npx tracepact run --budget 50000  # abort if live tokens exceed 50,000
```

## Mock-Only CI

Run only replay tests (no API calls, free):

```bash
npx tracepact run  # default — no --live flag
```
