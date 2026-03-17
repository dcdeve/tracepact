import { createHash } from 'node:crypto';

export class EmbeddingCache {
  private cache = new Map<string, number[]>();

  private key(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }

  get(text: string): number[] | undefined {
    return this.cache.get(this.key(text));
  }

  set(text: string, embedding: number[]): void {
    this.cache.set(this.key(text), embedding);
  }

  has(text: string): boolean {
    return this.cache.has(this.key(text));
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Shared singleton cache used by all embedding-based matchers (tier3 + RAG). */
export const globalEmbeddingCache = new EmbeddingCache();

export async function embedWithCache(
  provider: import('./embeddings.js').EmbeddingProvider,
  texts: string[]
): Promise<number[][]> {
  const uncached: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    if (!globalEmbeddingCache.has(texts[i] as string)) {
      uncached.push(texts[i] as string);
    }
  }

  if (uncached.length > 0) {
    const embeddings = await provider.embed(uncached);
    if (embeddings.length !== uncached.length) {
      throw new Error(
        `Embedding provider returned ${embeddings.length} embeddings for ${uncached.length} inputs.`
      );
    }
    for (let i = 0; i < uncached.length; i++) {
      globalEmbeddingCache.set(uncached[i] as string, embeddings[i] as number[]);
    }
  }

  return texts.map((t) => {
    const embedding = globalEmbeddingCache.get(t);
    if (embedding === undefined) {
      throw new Error(`Embedding not found in cache for text: "${t.slice(0, 50)}"`);
    }
    return embedding;
  });
}

/** Clear the shared global embedding cache (call between test suites if needed). */
export function clearEmbeddingCache(): void {
  globalEmbeddingCache.clear();
}
