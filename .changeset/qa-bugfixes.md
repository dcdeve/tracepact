---
"@tracepact/core": patch
"@tracepact/vitest": patch
---

fix: QA findings — TraceBuilder chaining, matcher compatibility, docs

- `TraceBuilder.addCall()` now returns `this` for method chaining, plus a shorthand overload `addCall(name, args, result)`
- `toHaveFileWritten()` accepts both `WriteCapture[]` and `ToolTrace` (extracts writes from trace automatically)
- `toMatchJsonSchema()` uses `safeParse` for Zod compatibility, with `parse` fallback
- Fixed README record/replay example (wrong params) and install command (missing `@tracepact/cli`)
- Documented conditional matchers, `toMention` stem option, and `runSkill` mock-mode behavior
