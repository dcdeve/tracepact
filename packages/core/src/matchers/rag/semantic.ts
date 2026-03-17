import type { ToolTrace } from '../../trace/types.js';
import { cosineSimilarity } from '../tier3/cosine.js';
import { embedWithCache } from '../tier3/embedding-cache.js';
import type { EmbeddingProvider } from '../tier3/embeddings.js';
import { estimateEmbeddingTokens } from '../tier3/embeddings.js';
import type { MatcherResult } from '../types.js';

function getRetrievalResults(trace: ToolTrace, toolName: string): string[] {
  const docs: string[] = [];
  for (const call of trace.calls) {
    if (call.toolName !== toolName || call.result.type !== 'success') continue;
    try {
      const parsed: unknown = JSON.parse(call.result.content);
      const items = extractArray(parsed);
      for (const item of items) {
        const text = extractText(item);
        if (text) docs.push(text);
      }
    } catch {
      // Non-JSON content — use raw
      if (call.result.content.trim()) docs.push(call.result.content);
    }
  }
  return docs;
}

function extractArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    for (const key of ['results', 'documents', 'items', 'data', 'hits']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [parsed];
}

function extractText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    // Common fields: content, text, body, snippet, page_content
    for (const key of ['content', 'text', 'body', 'snippet', 'page_content']) {
      if (typeof obj[key] === 'string') return obj[key] as string;
    }
    return JSON.stringify(item);
  }
  return String(item);
}

function getRetrievalQuery(trace: ToolTrace, toolName: string): string | null {
  for (const call of trace.calls) {
    if (call.toolName !== toolName) continue;
    const args = call.args as Record<string, unknown>;
    for (const key of ['query', 'q', 'search', 'question', 'input']) {
      if (typeof args[key] === 'string') return args[key] as string;
    }
  }
  return null;
}

export interface GroundingOptions {
  threshold?: number; // default: 0.80
  provider: EmbeddingProvider;
}

export async function toHaveGroundedResponseIn(
  trace: ToolTrace,
  output: string,
  toolName: string,
  options: GroundingOptions
): Promise<MatcherResult> {
  const threshold = options.threshold ?? 0.8;
  const docs = getRetrievalResults(trace, toolName);

  if (docs.length === 0) {
    return {
      pass: false,
      message: `No retrieval results found for "${toolName}" to check grounding against.`,
      tier: 3,
      diagnostic: {
        expected: `output grounded in "${toolName}" results`,
        received: '(no retrieval results)',
        tokens: 0,
      },
    };
  }

  // Compare output embedding against each doc, take max similarity
  const allTexts = [output, ...docs];
  const embeddings = await embedWithCache(options.provider, allTexts);
  const outputEmb = embeddings[0] as number[];

  let maxSimilarity = -1;
  let bestDoc = '';
  for (let i = 0; i < docs.length; i++) {
    const sim = cosineSimilarity(outputEmb, embeddings[i + 1] as number[]);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      bestDoc = (docs[i] as string).slice(0, 100);
    }
  }

  const tokens = estimateEmbeddingTokens(...allTexts);

  if (maxSimilarity >= threshold) {
    return {
      pass: true,
      message: `Output is grounded in "${toolName}" results (similarity ${maxSimilarity.toFixed(3)} ≥ ${threshold}).`,
      tier: 3,
      diagnostic: { expected: threshold, received: maxSimilarity, tokens },
    };
  }

  return {
    pass: false,
    message: `Output not sufficiently grounded in "${toolName}" results (max similarity ${maxSimilarity.toFixed(3)} < ${threshold}).`,
    tier: 3,
    diagnostic: {
      expected: `similarity ≥ ${threshold}`,
      received: `max similarity = ${maxSimilarity.toFixed(3)}`,
      suggestion: `Best matching doc: "${bestDoc}…"`,
      tokens,
    },
  };
}

export interface HallucinationOptions {
  threshold?: number; // default: 0.70 — sentences below this are flagged
  provider: EmbeddingProvider;
}

export async function toNotHaveHallucinated(
  trace: ToolTrace,
  output: string,
  toolName: string,
  options: HallucinationOptions
): Promise<MatcherResult> {
  const threshold = options.threshold ?? 0.7;
  const docs = getRetrievalResults(trace, toolName);

  if (docs.length === 0) {
    return {
      pass: false,
      message: `No retrieval results found for "${toolName}" to check hallucinations against.`,
      tier: 3,
      diagnostic: {
        expected: `output claims supported by "${toolName}" results`,
        received: '(no retrieval results)',
        tokens: 0,
      },
    };
  }

  // Split output into sentences/claims.
  // Also split on newlines and list-item markers so bullet-point outputs are handled.
  const sentences = output
    .split(/[.!?\n]+|(?:^|\n)\s*[-*•]\s*/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (sentences.length === 0) {
    return {
      pass: false,
      message: 'No checkable sentences found in output — cannot verify hallucinations.',
      tier: 3,
      diagnostic: {
        expected: 'no hallucinations',
        received: 'skipped: no checkable sentences',
        tokens: 0,
      },
    };
  }

  // Embed all sentences + all docs
  const allTexts = [...sentences, ...docs];
  const embeddings = await embedWithCache(options.provider, allTexts);
  const sentenceEmbs = embeddings.slice(0, sentences.length);
  const docEmbs = embeddings.slice(sentences.length);

  // For each sentence, find max similarity to any doc
  const unsupported: Array<{ sentence: string; maxSim: number }> = [];
  for (let i = 0; i < sentences.length; i++) {
    let maxSim = -1;
    for (let j = 0; j < docs.length; j++) {
      const sim = cosineSimilarity(sentenceEmbs[i] as number[], docEmbs[j] as number[]);
      if (sim > maxSim) maxSim = sim;
    }
    if (maxSim < threshold) {
      unsupported.push({ sentence: sentences[i] as string, maxSim });
    }
  }

  const tokens = estimateEmbeddingTokens(...allTexts);

  if (unsupported.length === 0) {
    return {
      pass: true,
      message: `All ${sentences.length} claims are supported by "${toolName}" results.`,
      tier: 3,
      diagnostic: {
        expected: 'no hallucinations',
        received: `${sentences.length} claims, all supported`,
        tokens,
      },
    };
  }

  return {
    pass: false,
    message: `${unsupported.length}/${sentences.length} claims may be unsupported by "${toolName}" results.`,
    tier: 3,
    diagnostic: {
      expected: `all claims above ${threshold} similarity`,
      received: unsupported.map((u) => `"${u.sentence.slice(0, 80)}…" (${u.maxSim.toFixed(3)})`),
      suggestion: `${unsupported.length} potentially hallucinated claim(s). Review manually.`,
      tokens,
    },
  };
}

export interface RetrievalScoreOptions {
  threshold?: number; // default: 0.75
  provider: EmbeddingProvider;
}

export async function toHaveRetrievalScore(
  trace: ToolTrace,
  toolName: string,
  options: RetrievalScoreOptions
): Promise<MatcherResult> {
  const threshold = options.threshold ?? 0.75;
  const query = getRetrievalQuery(trace, toolName);

  if (!query) {
    return {
      pass: false,
      message: `No query found in "${toolName}" tool call args.`,
      tier: 3,
      diagnostic: {
        expected: `retrieval score ≥ ${threshold}`,
        received: '(no query found)',
        suggestion:
          'Expected a "query", "q", "search", "question", or "input" arg in the tool call.',
        tokens: 0,
      },
    };
  }

  const docs = getRetrievalResults(trace, toolName);

  if (docs.length === 0) {
    return {
      pass: false,
      message: `No retrieval results found for "${toolName}".`,
      tier: 3,
      diagnostic: {
        expected: `retrieval score ≥ ${threshold}`,
        received: '(no results)',
        tokens: 0,
      },
    };
  }

  // Embed query + all docs, compute average similarity
  const allTexts = [query, ...docs];
  const embeddings = await embedWithCache(options.provider, allTexts);
  const queryEmb = embeddings[0] as number[];

  let totalSim = 0;
  for (let i = 0; i < docs.length; i++) {
    totalSim += cosineSimilarity(queryEmb, embeddings[i + 1] as number[]);
  }
  const avgScore = totalSim / docs.length;
  const tokens = estimateEmbeddingTokens(...allTexts);

  if (avgScore >= threshold) {
    return {
      pass: true,
      message: `Retrieval score ${avgScore.toFixed(3)} ≥ ${threshold} for "${toolName}".`,
      tier: 3,
      diagnostic: { expected: threshold, received: avgScore, tokens },
    };
  }

  return {
    pass: false,
    message: `Retrieval score ${avgScore.toFixed(3)} < ${threshold} for "${toolName}".`,
    tier: 3,
    diagnostic: {
      expected: `avg similarity ≥ ${threshold}`,
      received: `avg similarity = ${avgScore.toFixed(3)}`,
      suggestion: `Query: "${query.slice(0, 80)}" — results may not be relevant.`,
      tokens,
    },
  };
}
