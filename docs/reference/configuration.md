# Configuration

## `tracepact.config.ts`

### Simple: model shorthand

```typescript
import { defineConfig } from '@tracepact/core';

export default defineConfig({
  model: 'anthropic/claude-sonnet-4-5-20250929',
  roles: {
    judge: 'anthropic/claude-haiku-4-5-20251001',
    embedding: 'openai/text-embedding-3-small',
  },
});
```

The `model` shorthand (`"provider/model"`) auto-expands into a full `providers` block. Use `roles` to assign different models per purpose:

- **`agent`** — model for live agent tests (defaults to `model`)
- **`judge`** — cheap model for `toPassJudge` assertions
- **`embedding`** — embedding model for `toBeSemanticallySimilar` and `toHaveSemanticOverlap`

### Advanced: explicit providers

```typescript
import { defineConfig } from '@tracepact/core';

export default defineConfig({
  providers: {
    default: 'openai',
    openai:     { model: 'gpt-4o' },
    anthropic:  { model: 'claude-sonnet-4-5-20250929' },
    groq:       { model: 'llama-3.3-70b-versatile' },
    deepseek:   { model: 'deepseek-chat' },
    mistral:    { model: 'mistral-large-latest' },
  },
  cache: {
    enabled: true,
    dir: '.tracepact/cache',
    ttlSeconds: 86400,
    verifyOnRead: true,
  },
  redaction: {
    rules: [
      { pattern: /sk-[a-zA-Z0-9]+/, replacement: '[REDACTED_KEY]' },
    ],
    redactEnvValues: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
  },
});
```

### Provider config options

```typescript
interface ProviderConfig {
  model: string;
  apiKey?: string;        // defaults to env var (e.g. OPENAI_API_KEY)
  baseURL?: string;       // custom endpoint
  maxConcurrency?: number;
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TRACEPACT_LIVE` | Enable live tests (`1`) |
| `TRACEPACT_FULL` | Enable all tests including expensive (`1`) |
| `TRACEPACT_PROVIDER` | Provider name |
| `TRACEPACT_MODEL` | Override model for the default provider |
| `TRACEPACT_BUDGET` | Max live tokens (budget limit) |
| `TRACEPACT_RECORD` | Record cassettes (`1`) |
| `TRACEPACT_REPLAY` | Replay directory path |
| `TRACEPACT_NO_CACHE` | Skip cache (`1`) |
| `TRACEPACT_LOG` | Log level: `debug`, `info`, `warn`, `error` |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GROQ_API_KEY` | Groq API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `MISTRAL_API_KEY` | Mistral API key |
| `TOGETHER_API_KEY` | Together AI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `XAI_API_KEY` | xAI API key |
| `CEREBRAS_API_KEY` | Cerebras API key |
| `FIREWORKS_API_KEY` | Fireworks API key |
| `PERPLEXITY_API_KEY` | Perplexity API key |

## Model Catalog

TracePact maintains a model catalog fetched from [models.dev](https://models.dev):

1. **Fetch** — Downloads the latest catalog from models.dev API
2. **Cache** — Stores locally at `~/.tracepact/models-cache.json` (24h TTL)
3. **Snapshot** — Falls back to a static snapshot if offline

Browse with `tracepact models` or `tracepact models <provider> --verbose`.
