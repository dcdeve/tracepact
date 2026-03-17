import {
  type MockSandbox,
  type MockToolDefs,
  captureWrites,
  createMockTools,
  denyAll,
  executePrompt,
  mockReadFile,
  parseSkill,
  passthrough,
} from '@tracepact/core';

export interface ToolMockConfig {
  type: 'readFile' | 'writeFile' | 'bash' | 'deny' | 'passthrough';
  /** Virtual file contents for readFile mocks */
  files?: Record<string, string>;
}

export interface TracepactProviderConfig {
  /** Path to SKILL.md file */
  skill?: string;
  /** Inline system prompt (alternative to skill) */
  systemPrompt?: string;
  /** Provider name: "openai", or a preset name like "groq", "deepseek" */
  provider?: string;
  /** Model ID */
  model?: string;
  /** API key (overrides env var) */
  apiKey?: string;
  /** Base URL (overrides preset) */
  baseURL?: string;
  /** Mock tool definitions */
  tools?: Record<string, ToolMockConfig>;
  /** Max tool-use loop iterations */
  maxToolIterations?: number;
}

/**
 * Promptfoo custom provider that runs an agent through TracePact's
 * driver + mock sandbox and returns the tool trace as metadata.
 */
export class TracepactProvider {
  private config: TracepactProviderConfig;

  constructor(config: TracepactProviderConfig) {
    this.config = config;
  }

  id(): string {
    return `tracepact:${this.config.provider ?? 'openai'}:${this.config.model ?? 'default'}`;
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    // 1. Resolve skill or system prompt
    const skillInput = await this.resolveSkill();
    if ('error' in skillInput) return skillInput;

    // 2. Build sandbox from config
    const sandbox = this.buildSandbox();

    // 3. Build tracepactConfig from provider settings
    const providerName = this.config.provider ?? 'openai';
    const providerConfig = {
      model: this.config.model ?? 'gpt-4o',
      ...(this.config.apiKey ? { apiKey: this.config.apiKey } : {}),
      ...(this.config.baseURL ? { baseURL: this.config.baseURL } : {}),
    };

    // 4. Run via executePrompt (inherits cache, redaction, cassette recording, health checks)
    try {
      const result = await executePrompt(skillInput.skill, {
        prompt,
        sandbox,
        provider: providerName,
        tracepactConfig: {
          providers: {
            default: providerName,
            [providerName]: providerConfig,
          },
        },
        ...(this.config.maxToolIterations != null && {
          config: { maxToolIterations: this.config.maxToolIterations },
        }),
      });

      return {
        output: result.output,
        tokenUsage: {
          prompt: result.usage.inputTokens,
          completion: result.usage.outputTokens,
          total: result.usage.inputTokens + result.usage.outputTokens,
        },
        metadata: {
          trace: result.trace,
          duration: result.duration,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  private async resolveSkill(): Promise<{ skill: { systemPrompt: string } } | { error: string }> {
    if (this.config.skill) {
      const parsed = await parseSkill(this.config.skill);
      return { skill: { systemPrompt: parsed.body } };
    }
    if (this.config.systemPrompt) {
      return { skill: { systemPrompt: this.config.systemPrompt } };
    }
    return { error: 'TracepactProvider requires either `skill` or `systemPrompt` in config.' };
  }

  private buildSandbox(): MockSandbox {
    const defs: MockToolDefs = {};

    for (const [name, config] of Object.entries(this.config.tools ?? {})) {
      switch (config.type) {
        case 'readFile':
          defs[name] = mockReadFile(config.files ?? {});
          break;
        case 'writeFile':
          defs[name] = captureWrites();
          break;
        case 'deny':
          defs[name] = denyAll();
          break;
        default:
          defs[name] = passthrough();
      }
    }

    return createMockTools(defs);
  }
}

/** Minimal Promptfoo provider response shape (avoids hard dependency on promptfoo types) */
interface ProviderResponse {
  output?: string;
  error?: string;
  tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  metadata?: Record<string, unknown>;
}
