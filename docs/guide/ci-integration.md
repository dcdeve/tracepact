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
      - uses: dcdeve/tracepact@v1
        with:
          live: ${{ github.ref == 'refs/heads/main' }}
          budget: "100000"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Manual CI Setup

```bash
npm install -D @tracepact/core @tracepact/vitest @tracepact/cli
npx tracepact --json
```

Results are written to `.tracepact/results.json`.

## Cost Control

```bash
npx tracepact --budget 50000  # abort if live tokens exceed 50,000
```

## Mock-Only CI

Run only replay tests (no API calls, free):

```bash
npx tracepact  # default — no --live flag
```
