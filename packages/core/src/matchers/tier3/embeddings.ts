export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly model: string;
  readonly dimensions: number;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;

  private client: any = null;
  private apiKey: string;

  constructor(apiKey?: string, model = 'text-embedding-3-small', dimensions = 1536) {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY required for semantic assertions (Tier 3).');
    }
    this.apiKey = key;
    this.model = model;
    this.dimensions = dimensions;
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      const { default: OpenAI } = await import('openai');
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const client = await this.getClient();
    const response = await client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
  }
}

/**
 * Estimate token usage for embedding based on character count (~4 chars per token).
 */
export function estimateEmbeddingTokens(...texts: string[]): number {
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  return Math.ceil(totalChars / 4);
}
