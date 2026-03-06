import {
  type AgentDriver,
  type MockSandbox,
  type MockToolDefs,
  OpenAIDriver,
  PROVIDER_ENV_KEYS,
  PROVIDER_PRESETS,
  captureWrites,
  createMockTools,
  denyAll,
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

    // 3. Create driver
    const driver = this.createDriver();

    // 4. Run agent
    try {
      const result = await driver.run({
        skill: skillInput.skill,
        prompt,
        sandbox,
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

  private createDriver(): AgentDriver {
    const providerName = this.config.provider ?? 'openai';
    const preset = PROVIDER_PRESETS[providerName];

    const baseURL = this.config.baseURL ?? preset?.baseURL;
    const envKey = PROVIDER_ENV_KEYS[providerName];
    const apiKey = this.config.apiKey ?? (envKey ? process.env[envKey] : undefined);

    const model = this.config.model ?? 'gpt-4o';

    const opts: Record<string, unknown> = {
      model,
      providerName,
    };
    if (apiKey) opts.apiKey = apiKey;
    if (baseURL) opts.baseURL = baseURL;

    return new OpenAIDriver(opts as any);
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
