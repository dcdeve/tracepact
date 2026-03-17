# Semantic Assertions (Tier 3)

Embedding-based assertions compare meaning, not exact text.

## `toBeSemanticallySimilar`

```typescript
import { OpenAIEmbeddingProvider } from '@tracepact/core';

const provider = new OpenAIEmbeddingProvider();

expect(result).toBeSemanticallySimilar(
  'The deployment was successful',
  { threshold: 0.80, provider }
);
```

Requires an explicit `provider` — there is no automatic default. Pass an `OpenAIEmbeddingProvider` instance (the only bundled implementation) or any custom object satisfying the `EmbeddingProvider` interface.

## `toHaveSemanticOverlap`

```typescript
import { OpenAIEmbeddingProvider } from '@tracepact/core';

const provider = new OpenAIEmbeddingProvider();

expect(result).toHaveSemanticOverlap(
  ['deployment', 'success', 'rollout'],
  { threshold: 0.75, provider }
);
```

## Cost

~50 tokens per assertion. Cached by default.

## Requirements

- `OPENAI_API_KEY` environment variable
- `--live` or `--full` flag to enable
