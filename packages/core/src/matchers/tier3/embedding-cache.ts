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

/**
 * Tracks in-flight embedding requests keyed by text to avoid duplicate API
 * calls when multiple concurrent callers request the same text simultaneously.
 */
const inFlight = new Map<string, Promise<number[]>>();

export async function embedWithCache(
  provider: import('./embeddings.js').EmbeddingProvider,
  texts: string[]
): Promise<number[][]> {
  // Collect texts that are neither cached nor already in-flight.
  const needsFetch: string[] = [];
  for (const text of texts) {
    if (!globalEmbeddingCache.has(text) && !inFlight.has(text)) {
      needsFetch.push(text);
    }
  }

  // Fire one batched request for all texts that truly need fetching, and
  // register each individual result as an in-flight promise so concurrent
  // calls for the same texts coalesce instead of duplicating the request.
  if (needsFetch.length > 0) {
    const batchPromise = provider.embed(needsFetch).then((embeddings) => {
      if (embeddings.length !== needsFetch.length) {
        throw new Error(
          `Embedding provider returned ${embeddings.length} embeddings for ${needsFetch.length} inputs.`
        );
      }
      for (let i = 0; i < needsFetch.length; i++) {
        globalEmbeddingCache.set(needsFetch[i] as string, embeddings[i] as number[]);
      }
      return embeddings;
    });

    for (let i = 0; i < needsFetch.length; i++) {
      const text = needsFetch[i] as string;
      const textIndex = i;
      const pending = batchPromise
        .then((embeddings) => embeddings[textIndex] as number[])
        .finally(() => {
          inFlight.delete(text);
        });
      inFlight.set(text, pending);
    }
  }

  // For each text, resolve from cache (already written) or await its
  // in-flight promise (covers both newly-queued and pre-existing in-flight).
  return Promise.all(
    texts.map((text): Promise<number[]> => {
      const cached = globalEmbeddingCache.get(text);
      if (cached !== undefined) {
        return Promise.resolve(cached);
      }
      const promise = inFlight.get(text);
      if (promise !== undefined) {
        return promise;
      }
      // Should never reach here; guard for safety.
      throw new Error(`Embedding not found in cache or in-flight for text: "${text.slice(0, 50)}"`);
    })
  );
}

/** Clear the shared global embedding cache (call between test suites if needed). */
export function clearEmbeddingCache(): void {
  globalEmbeddingCache.clear();
}
