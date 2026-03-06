---
"@tracepact/core": patch
"@tracepact/vitest": patch
---

fix: make defineTools compatible with zod v3 and v4, accept raw JSON schemas

- zodToJsonSchema now handles both zod v3 (shape as function) and v4 (shape as object)
- Try zod v4's built-in toJSONSchema() when available
- Accept plain JSON schema objects as alternative to zod schemas in defineTools
- Add support for ZodDefault and ZodNullable types
- runSkill() now warns when called without TRACEPACT_LIVE or replay
- driver.run() validates RunInput.skill with clear error message
