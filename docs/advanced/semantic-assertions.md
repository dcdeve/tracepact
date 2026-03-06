# Semantic Assertions (Tier 3)

Embedding-based assertions compare meaning, not exact text.

## `toBeSemanticallySimilar`

```typescript
expect(result).toBeSemanticallySimilar(
  'The deployment was successful',
  { threshold: 0.80 }
);
```

Uses OpenAI `text-embedding-3-small` by default.

## `toHaveSemanticOverlap`

```typescript
expect(result).toHaveSemanticOverlap(referenceOutput, {
  threshold: 0.75,
});
```

## Cost

~50 tokens per assertion. Cached by default.

## Requirements

- `OPENAI_API_KEY` environment variable
- `--live` or `--full` flag to enable
