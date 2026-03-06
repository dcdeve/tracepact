# Flake Scoring

Track test reliability over time. Tests with >10% failure rate over 3+ runs are marked `[FLAKY]`.

## How It Works

TracePact records pass/fail results in `.tracepact/flake-history.json` (local, per-developer). After enough data, flaky tests are tagged:

```
✓ reads the source file (12ms)
✓ never writes files (8ms)
✗ identifies SQL injection (2341ms) [FLAKY: 30% failure rate over 10 runs]
```

## Thresholds

- Minimum 3 runs before tagging
- >10% failure rate = flaky
- Last 10 runs per test (older trimmed)

## In JSON Reporter

```json
{
  "name": "identifies SQL injection",
  "status": "fail",
  "flake": { "failureRate": 0.30, "totalRuns": 10, "isFlaky": true }
}
```

## Best Practices

- Tier 3-4 tests are inherently less deterministic — expect some flake
- Use `toMatchTrajectory` with T0 constraints to reduce false positives
- Flaky tests should not block CI — use for monitoring
