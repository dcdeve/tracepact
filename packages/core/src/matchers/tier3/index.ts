import type { MatcherResult } from '../types.js';
import { cosineSimilarity } from './cosine.js';
import { embedWithCache } from './embedding-cache.js';
import type { EmbeddingProvider } from './embeddings.js';
import { estimateEmbeddingTokens } from './embeddings.js';

export type { EmbeddingProvider } from './embeddings.js';
export { OpenAIEmbeddingProvider, estimateEmbeddingTokens } from './embeddings.js';
export { cosineSimilarity } from './cosine.js';
export { EmbeddingCache, clearEmbeddingCache } from './embedding-cache.js';

export interface SemanticSimilarityOptions {
  threshold?: number; // default: 0.80
  provider: EmbeddingProvider;
}

export async function toBeSemanticallySimilar(
  output: string,
  reference: string,
  options: SemanticSimilarityOptions
): Promise<MatcherResult> {
  const threshold = options.threshold ?? 0.8;
  const provider = options.provider;

  let outputEmb: number[];
  let refEmb: number[];
  try {
    const embeddings = await embedWithCache(provider, [output, reference]);
    outputEmb = embeddings[0] as number[];
    refEmb = embeddings[1] as number[];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      pass: false,
      message: `API unavailable: ${message}`,
      tier: 3,
      diagnostic: { expected: threshold, received: 'API error', tokens: 0 },
    };
  }
  const similarity = cosineSimilarity(outputEmb, refEmb);
  const tokens = estimateEmbeddingTokens(output, reference);

  if (similarity >= threshold) {
    return {
      pass: true,
      message: `Semantic similarity ${similarity.toFixed(3)} ≥ ${threshold} threshold.`,
      tier: 3,
      diagnostic: { expected: threshold, received: similarity, tokens },
    };
  }

  const suggestion =
    similarity > threshold - 0.1
      ? `Close to threshold (within 0.10). Consider lowering threshold to ${(threshold - 0.05).toFixed(2)} or making the reference more general.`
      : `Output may be discussing a different topic than the reference. Preview: "${output.slice(0, 150)}…"`;

  return {
    pass: false,
    message: `Semantic similarity ${similarity.toFixed(3)} < ${threshold} threshold.`,
    tier: 3,
    diagnostic: {
      expected: `similarity ≥ ${threshold}`,
      received: `similarity = ${similarity.toFixed(3)}`,
      suggestion,
      tokens,
    },
  };
}

export interface SemanticOverlapOptions {
  threshold?: number; // per-topic similarity threshold, default: 0.75
  minTopics?: number; // minimum topics that must match, default: all
  provider: EmbeddingProvider;
}

export async function toHaveSemanticOverlap(
  output: string,
  topics: string[],
  options: SemanticOverlapOptions
): Promise<MatcherResult> {
  const threshold = options.threshold ?? 0.75;
  const minTopics = options.minTopics ?? topics.length;
  const provider = options.provider;

  const allTexts = [output, ...topics];
  let embeddings: (number[] | undefined)[];
  try {
    embeddings = await embedWithCache(provider, allTexts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      pass: false,
      message: `API unavailable: ${message}`,
      tier: 3,
      diagnostic: { expected: minTopics, received: 'API error', tokens: 0 },
    };
  }
  const outputEmb = embeddings[0] as number[];

  const results = topics.map((topic, i) => ({
    topic,
    similarity: cosineSimilarity(outputEmb, embeddings[i + 1] as number[]),
  }));

  const matched = results.filter((r) => r.similarity >= threshold);
  const tokens = estimateEmbeddingTokens(...allTexts);

  if (matched.length >= minTopics) {
    return {
      pass: true,
      message: `${matched.length}/${topics.length} topics matched (need ≥${minTopics}).`,
      tier: 3,
      diagnostic: { expected: minTopics, received: matched.length, tokens },
    };
  }

  const missed = results.filter((r) => r.similarity < threshold);
  return {
    pass: false,
    message: `Only ${matched.length}/${topics.length} topics matched (need ≥${minTopics}).`,
    tier: 3,
    diagnostic: {
      expected: `≥${minTopics} topics above ${threshold}`,
      received: results.map((r) => `"${r.topic}": ${r.similarity.toFixed(3)}`),
      suggestion: `Missed topics: ${missed.map((r) => `"${r.topic}" (${r.similarity.toFixed(3)})`).join(', ')}`,
      tokens,
    },
  };
}

// clearEmbeddingCache is re-exported from embedding-cache.ts
