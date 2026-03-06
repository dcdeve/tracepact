# TODO

## In Progress

- [ ] Streaming tests for AnthropicDriver — mock async iterator for event-based streaming (`message_start`, `content_block_delta`, `content_block_stop`)

## Tech Debt

- [ ] LRU cache for embedding cache — unbounded `Map` grows without limit in large suites. Evaluate `lru-cache` for max size and eviction (#6)
- [ ] OpenAIDriver tool-call loop dedup — ~100 LOC duplicated between streaming and non-streaming paths. Extract shared method (#7)
- [ ] Arg-matcher type mismatch message — confusing error when comparing array vs non-array values (#9)
- [ ] Markdown tokenizer edge case tests — nested code blocks, HTML content (#11)

## Release

- [ ] v0.3.0 release — finalize CHANGELOG, npm publish

## Deferred

- [ ] Outreach — Promptfoo GitHub Discussions / Discord
- [ ] Cross-provider live suite — run tests live against multiple providers, document behavioral differences
- [ ] Feedback fixes — needs adopter feedback first
