# Judge Assertions (Tier 4)

Tier 4 assertions use an LLM to evaluate whether an agent's output meets natural language criteria. They are flexible and expressive, but non-deterministic and expensive.

## When to Use

- Regression detection: "did the agent stop identifying this class of bugs?"
- Quality tracking: measuring output quality over time
- Exploratory testing: validating complex, hard-to-express criteria

## When NOT to Use

- **CI gates.** Judge assertions are non-deterministic. A flaky CI gate destroys developer trust. Use Tier 0-2 for CI; Tier 4 for monitoring.
- Simple checks. If you can express it as a regex or tool call assertion, do that instead.

## Basic Usage

```typescript
import { runSkill } from "@tracepact/vitest";

test.expensive("identifies SQL injection", async () => {
  const { output } = await runSkill(skill, { prompt: "Review this code", sandbox });

  expect(output).toPassJudge(
    "Identifies the SQL injection vulnerability and suggests parameterized queries",
    { driver }
  );
});
```

`toPassJudge` requires a `driver` — an `AgentDriver` instance that makes the LLM call. Typically an `OpenAIDriver` configured with your preferred judge model.

## Driver Setup

```typescript
import { OpenAIDriver } from "@tracepact/core";

// Claude Haiku via Anthropic's OpenAI-compatible endpoint
const driver = new OpenAIDriver({
  model: "claude-haiku-4-5-20251001",
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: "https://api.anthropic.com/v1/",
});

// Or OpenAI directly
const driver = new OpenAIDriver({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
});
```

## Calibration

Calibration sets provide few-shot examples that reduce judge variance. Three bundled sets ship with TracePact:

- `code-review` — security vulnerability detection
- `deploy` — deployment process evaluation
- `documentation` — documentation quality assessment

```typescript
expect(output).toPassJudge("Identifies the vulnerability", {
  driver,
  calibration: "code-review",
});
```

### Custom Calibration

Create a YAML file with pass/fail examples:

```yaml
# my-calibration.yaml
examples:
  - input: "Summarize the report"
    output: "Revenue increased 15% YoY driven by enterprise sales."
    pass: true
    justification: "Concise summary with key metric."

  - input: "Summarize the report"
    output: "The report is about business."
    pass: false
    justification: "Too vague, no specific data."
```

```typescript
import { loadCustomCalibration } from "@tracepact/core";

const calibration = await loadCustomCalibration("./my-calibration.yaml");

expect(output).toPassJudge("Accurate summary with key metrics", {
  driver,
  calibration,
});
```

## Consensus

Run multiple independent judge calls and use majority vote. This reduces single-call variance.

```typescript
expect(output).toPassJudge("Identifies the vulnerability", {
  driver,
  calibration: "code-review",
  consensus: 3, // 3 independent calls, majority wins
});
```

When `consensus > 1`, temperature defaults to 0.3 (enough variance for meaningful disagreement). When `consensus = 1`, temperature defaults to 0.

The diagnostic includes consensus counts:

```
Judge: FAIL (0.85 confidence). Missing specific fix suggestion.
Consensus: 1/3 judges passed.
```

## Cost

Every judge call uses tokens. It appears in:

- `MatcherResult.diagnostic.tokens` per assertion
- `tracepact cost-report` aggregate

A single `toPassJudge` with `consensus: 3` using Haiku uses roughly ~450 tokens. Set --budget accordingly.

## `test.expensive()`

Judge assertions should be wrapped in `test.expensive()` so they don't run by default:

```typescript
import { expensive } from "@tracepact/vitest";

expensive("output quality check", async () => {
  const { output } = await runSkill(skill, { prompt, sandbox });
  expect(output).toPassJudge("Comprehensive and actionable", { driver });
});
```

Run with `tracepact --full` to include expensive tests. `--full` implies `--live`.

| Flag | `test()` | `test.live()` | `test.expensive()` |
|------|----------|---------------|---------------------|
| (none) | runs | skip | skip |
| `--live` | runs | runs | skip |
| `--full` | runs | runs | runs |

## Options Reference

```typescript
interface ToPassJudgeOptions {
  driver?: AgentDriver;          // LLM driver for judge calls
  calibration?: string | CalibrationSet; // bundled name or custom set
  model?: string;                // override model for judge calls
  provider?: string;             // override provider for judge calls
  consensus?: number;            // default: 1
  temperature?: number;          // default: 0 (single) or 0.3 (consensus)
  maxTokens?: number;            // default: 1024
}
```
