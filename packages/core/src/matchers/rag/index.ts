import type { ToolTrace } from '../../trace/types.js';
import type { MatcherResult } from '../types.js';

/**
 * Parse retrieval results from a tool call's result content.
 * Handles common patterns: direct array, { results: [...] }, { documents: [...] }, { items: [...] }
 */
function parseRetrievalResults(content: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      for (const key of ['results', 'documents', 'items', 'data', 'hits']) {
        if (Array.isArray(obj[key])) return obj[key] as unknown[];
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Check if a document matches a partial matcher object.
 * Every key in the matcher must exist in the doc with a matching value.
 */
function matchesDoc(doc: unknown, matcher: Record<string, unknown>): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const obj = doc as Record<string, unknown>;

  for (const [key, expected] of Object.entries(matcher)) {
    const actual = obj[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (!matchesDoc(actual, expected as Record<string, unknown>)) return false;
    } else if (typeof expected === 'string' && typeof actual === 'string') {
      if (!actual.includes(expected)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

function getRetrievalCalls(trace: ToolTrace, toolName: string) {
  return trace.calls.filter((c) => c.toolName === toolName);
}

function getAllResults(trace: ToolTrace, toolName: string): unknown[] {
  const calls = getRetrievalCalls(trace, toolName);
  const results: unknown[] = [];
  for (const call of calls) {
    if (call.result.type === 'success') {
      results.push(...parseRetrievalResults(call.result.content));
    }
  }
  return results;
}

export function toHaveRetrievedDocument(
  trace: ToolTrace,
  toolName: string,
  docMatcher: Record<string, unknown>
): MatcherResult {
  const results = getAllResults(trace, toolName);

  if (results.length === 0) {
    const calls = getRetrievalCalls(trace, toolName);
    return {
      pass: false,
      message: `Expected "${toolName}" to retrieve a matching document, but no retrieval results found.`,
      tier: 0,
      diagnostic: {
        expected: docMatcher,
        received: { resultsCount: 0, callsCount: calls.length },
        suggestion:
          calls.length === 0
            ? `"${toolName}" was never called.`
            : 'Tool was called but returned no parseable results.',
        tokens: 0,
      },
    };
  }

  const found = results.some((doc) => matchesDoc(doc, docMatcher));
  if (!found) {
    return {
      pass: false,
      message: `Expected "${toolName}" to retrieve a document matching ${JSON.stringify(docMatcher)}, but none matched.`,
      tier: 0,
      diagnostic: {
        expected: docMatcher,
        received: results.slice(0, 5),
        suggestion: `${results.length} document(s) retrieved, none matched the criteria.`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `"${toolName}" retrieved a matching document.`,
    tier: 0,
    diagnostic: { expected: docMatcher, received: docMatcher, tokens: 0 },
  };
}

export function toHaveRetrievedTopResult(
  trace: ToolTrace,
  toolName: string,
  docMatcher: Record<string, unknown>
): MatcherResult {
  const results = getAllResults(trace, toolName);

  if (results.length === 0) {
    return {
      pass: false,
      message: `Expected "${toolName}" top result to match, but no retrieval results found.`,
      tier: 0,
      diagnostic: {
        expected: docMatcher,
        received: '(no results)',
        suggestion: 'No retrieval results to check.',
        tokens: 0,
      },
    };
  }

  const top = results[0];
  if (!matchesDoc(top, docMatcher)) {
    return {
      pass: false,
      message: `Expected "${toolName}" top result to match ${JSON.stringify(docMatcher)}, but it didn't.`,
      tier: 0,
      diagnostic: {
        expected: docMatcher,
        received: top,
        suggestion: 'The first retrieved document did not match the criteria.',
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `"${toolName}" top result matches.`,
    tier: 0,
    diagnostic: { expected: docMatcher, received: top, tokens: 0 },
  };
}

export function toNotHaveRetrievedDocument(
  trace: ToolTrace,
  toolName: string,
  docMatcher: Record<string, unknown>
): MatcherResult {
  const results = getAllResults(trace, toolName);
  const found = results.find((doc) => matchesDoc(doc, docMatcher));

  if (found) {
    return {
      pass: false,
      message: `Expected "${toolName}" to NOT retrieve a document matching ${JSON.stringify(docMatcher)}, but one was found.`,
      tier: 0,
      diagnostic: {
        expected: { absent: docMatcher },
        received: found,
        suggestion: 'A matching document was found in the retrieval results.',
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `"${toolName}" did not retrieve a matching document.`,
    tier: 0,
    diagnostic: { expected: { absent: docMatcher }, received: { absent: true }, tokens: 0 },
  };
}

export function toHaveRetrievedNResults(
  trace: ToolTrace,
  toolName: string,
  n: number
): MatcherResult {
  const results = getAllResults(trace, toolName);

  if (results.length !== n) {
    return {
      pass: false,
      message: `Expected "${toolName}" to retrieve ${n} result(s), but got ${results.length}.`,
      tier: 0,
      diagnostic: {
        expected: { count: n },
        received: { count: results.length },
        suggestion: `Retrieved ${results.length} document(s) instead of ${n}.`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `"${toolName}" retrieved ${n} result(s).`,
    tier: 0,
    diagnostic: { expected: n, received: n, tokens: 0 },
  };
}

export function toHaveCitedSources(output: string, sources: string[]): MatcherResult {
  const missing = sources.filter((s) => !output.includes(s));

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Expected output to cite all sources, but ${missing.length} missing: [${missing.join(', ')}].`,
      tier: 0,
      diagnostic: {
        expected: sources,
        received: { missing },
        suggestion: `Missing citations: ${missing.join(', ')}`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `Output cites all ${sources.length} source(s).`,
    tier: 0,
    diagnostic: { expected: sources, received: sources, tokens: 0 },
  };
}
