export interface ProviderPreset {
  baseURL: string;
  envKey: string;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  groq: { baseURL: 'https://api.groq.com/openai/v1', envKey: 'GROQ_API_KEY' },
  deepseek: { baseURL: 'https://api.deepseek.com', envKey: 'DEEPSEEK_API_KEY' },
  together: { baseURL: 'https://api.together.xyz/v1', envKey: 'TOGETHER_API_KEY' },
  mistral: { baseURL: 'https://api.mistral.ai/v1', envKey: 'MISTRAL_API_KEY' },
  openrouter: { baseURL: 'https://openrouter.ai/api/v1', envKey: 'OPENROUTER_API_KEY' },
  xai: { baseURL: 'https://api.x.ai/v1', envKey: 'XAI_API_KEY' },
  cerebras: { baseURL: 'https://api.cerebras.ai/v1', envKey: 'CEREBRAS_API_KEY' },
  fireworks: { baseURL: 'https://api.fireworks.ai/inference/v1', envKey: 'FIREWORKS_API_KEY' },
  perplexity: { baseURL: 'https://api.perplexity.ai', envKey: 'PERPLEXITY_API_KEY' },
};

export const PROVIDER_ENV_KEYS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  ...Object.fromEntries(
    Object.entries(PROVIDER_PRESETS).map(([name, preset]) => [name, preset.envKey])
  ),
};
