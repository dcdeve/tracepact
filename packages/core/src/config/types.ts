export interface ModelRoles {
  /** Model for live agent tests (e.g. "anthropic/claude-sonnet-4-5-20250929") */
  agent?: string;
  /** Cheap model for toPassJudge assertions (e.g. "anthropic/claude-haiku-4-5-20251001") */
  judge?: string;
  /** Embedding model for semantic assertions (e.g. "openai/text-embedding-3-small") */
  embedding?: string;
}

export interface TracepactConfig {
  skill?: string;
  /** Shorthand: "provider/model" (e.g. "anthropic/claude-sonnet-4-5-20250929") */
  model?: string;
  /** Model assignments per role. Auto-selected from model if omitted. */
  roles?: ModelRoles;
  providers: {
    default: string;
    [name: string]: ProviderConfig | string;
  };
  cache: CacheConfig;
  redaction: RedactionConfig;
  vitest?: Record<string, unknown>;
}

export interface ProviderConfig {
  model: string;
  apiKey?: string;
  baseURL?: string;
  maxConcurrency?: number;
  retry?: RetryConfig;
}

export interface RetryConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface CacheConfig {
  enabled: boolean;
  dir: string;
  ttlSeconds: number;
  verifyOnRead: boolean;
}

export interface RedactionConfig {
  rules: RedactionRule[];
  redactEnvValues: string[];
}

export interface RedactionRule {
  pattern: RegExp;
  replacement: string;
}
