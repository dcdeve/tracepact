---
"@tracepact/core": patch
"@tracepact/cli": patch
---

docs: complete documentation for providers, audit rules, and skills.sh integration

- Document mock-only mode (defineConfig without provider)
- Add providers/presets table with OpenAI/Anthropic native SDK note
- Document audit rule naming convention (kebab-case vs camelCase)
- Add skills.sh fields to KNOWN_FRONTMATTER_FIELDS (no more warnings for version, license, metadata, user-invocable)
- Add skills.sh integration guide
- Fix npx tracepact references to npx @tracepact/cli in quick-start
