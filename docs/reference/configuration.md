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
    enabled: true,              // set to false to disable caching entirely (no reads or writes)
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

### Mock-only mode

If you only need mock tests (no live API calls), you can omit `model` and `providers` entirely:

```typescript
import { defineConfig } from '@tracepact/core';

export default defineConfig({});
```

This is useful when all your tests use `createMockTools` and don't call any LLM API. The config file itself is also optional for mock-only tests — you can use `@tracepact/core` directly with vitest.

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

### Providers and presets

TracePact supports any OpenAI-compatible provider. **OpenAI** and **Anthropic** use their native SDKs and don't need a preset — just set the API key env var.

All other providers use the OpenAI-compatible driver with a preset `baseURL`:

| Provider | Preset `baseURL` | Env var |
|----------|-----------------|---------|
| `openai` | *(native SDK)* | `OPENAI_API_KEY` |
| `anthropic` | *(native SDK)* | `ANTHROPIC_API_KEY` |
| `groq` | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` |
| `deepseek` | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` |
| `together` | `https://api.together.xyz/v1` | `TOGETHER_API_KEY` |
| `mistral` | `https://api.mistral.ai/v1` | `MISTRAL_API_KEY` |
| `openrouter` | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` |
| `xai` | `https://api.x.ai/v1` | `XAI_API_KEY` |
| `cerebras` | `https://api.cerebras.ai/v1` | `CEREBRAS_API_KEY` |
| `fireworks` | `https://api.fireworks.ai/inference/v1` | `FIREWORKS_API_KEY` |
| `perplexity` | `https://api.perplexity.ai` | `PERPLEXITY_API_KEY` |

To use a provider not in this list, set `baseURL` explicitly:

```typescript
export default defineConfig({
  providers: {
    default: 'custom',
    custom: {
      model: 'my-model',
      baseURL: 'https://my-provider.example.com/v1',
      apiKey: process.env.MY_API_KEY,
    },
  },
});
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
