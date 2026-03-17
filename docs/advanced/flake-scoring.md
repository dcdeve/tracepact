# Flake Scoring

Track test reliability over time using the `FlakeStore` API available in `@tracepact/core`.

> **Note:** `FlakeStore` is a low-level API that must be used manually. Automatic flake detection is **not** built into the vitest plugin — the JSON reporter does not record flake history, does not emit a `flake` field in results, and the console output does not show `[FLAKY]` labels. You must instrument your own code to use this feature.

## How It Works

`FlakeStore` (exported from `@tracepact/core`) persists pass/fail results in a JSON file (default: `.tracepact/flake-history.json`). After enough data is recorded, you can query whether a test is flaky via `getScore()`.

### Thresholds

- Minimum 3 runs before a test is considered flaky
- >10% failure rate = flaky
- Last 10 runs per test (older entries trimmed automatically)

## FlakeStore API

```ts
import { FlakeStore } from '@tracepact/core';

const store = new FlakeStore(); // default path: .tracepact/flake-history.json

// Load persisted history from disk
await store.load();

// Record a result for a test
store.record('my-test-id', /* pass */ true);

// Get the flake score for a specific test
const score = store.getScore('my-test-id');
// score: { testId, passCount, failCount, totalRuns, failureRate, isFlaky, lastRun }

// Get scores for all tracked tests
const allScores = store.getAllScores();

// Persist updated history to disk
await store.save();
```

### FlakeScore shape

```ts
interface FlakeScore {
  testId: string;
  passCount: number;
  failCount: number;
  totalRuns: number;
  failureRate: number; // e.g. 0.30 for 30%
  isFlaky: boolean;    // true when totalRuns >= 3 && failureRate > 0.1
  lastRun: string;     // ISO timestamp
}
```

## Manual Integration with Vitest

Because the vitest plugin does not call `FlakeStore` automatically, you can wire it up yourself in a global setup file:

```ts
// vitest.setup.ts
import { FlakeStore } from '@tracepact/core';

const store = new FlakeStore();

export async function setup() {
  await store.load();
}

export async function teardown() {
  await store.save();
}
```

Then record results in your test hooks as needed, using the test name or a stable identifier as `testId`.

## JSON Reporter Output

The vitest plugin's JSON reporter writes results to `.tracepact/results.json`. Each test entry has the following shape — there is **no** `flake` field:

```json
{
  "name": "identifies SQL injection",
  "file": "src/tests/security.test.ts",
  "status": "fail",
  "duration": 2341
}
```

Flake data lives separately in `.tracepact/flake-history.json`, managed exclusively through `FlakeStore`.

## Best Practices

- Tier 3-4 tests are inherently less deterministic — expect some flake
- Use `toMatchTrajectory` with T0 constraints to reduce false positives
- Flaky tests should not block CI — use flake scores for monitoring only
