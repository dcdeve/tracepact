import { truncate } from '../arg-matcher.js';
import type { MatcherResult } from '../types.js';
import { stem } from '../utils/stemmer.js';

export function toContain(output: string, pattern: string | RegExp): MatcherResult {
  const matches = pattern instanceof RegExp ? pattern.test(output) : output.includes(pattern);

  if (!matches) {
    const preview = truncate(output, 200);
    return {
      pass: false,
      message: `Output does not match pattern: ${pattern}`,
      tier: 2,
      diagnostic: {
        expected: pattern instanceof RegExp ? pattern.toString() : pattern,
        received: `No match in ${output.length} characters`,
        suggestion: `Output preview: "${preview}"`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `Output contains ${pattern}.`,
    tier: 2,
    diagnostic: {
      expected: pattern instanceof RegExp ? pattern.toString() : pattern,
      received: 'match found',
      tokens: 0,
    },
  };
}

export function toNotContain(output: string, pattern: string | RegExp): MatcherResult {
  const matches = pattern instanceof RegExp ? pattern.test(output) : output.includes(pattern);

  if (matches) {
    return {
      pass: false,
      message: `Output should not contain pattern: ${pattern}`,
      tier: 2,
      diagnostic: {
        expected: `No match for ${pattern instanceof RegExp ? pattern.toString() : `"${pattern}"`}`,
        received: 'Pattern was found',
        suggestion: 'The pattern was found in the output.',
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `Output does not contain ${pattern}.`,
    tier: 2,
    diagnostic: { expected: 'no match', received: 'no match', tokens: 0 },
  };
}

export function toMention(
  output: string,
  term: string,
  options?: { stem?: boolean }
): MatcherResult {
  const normalizedOutput = output.toLowerCase();
  const normalizedTerm = term.toLowerCase();

  if (!options?.stem) {
    if (normalizedOutput.includes(normalizedTerm)) {
      return {
        pass: true,
        message: `Output mentions "${term}".`,
        tier: 2,
        diagnostic: { expected: term, received: term, tokens: 0 },
      };
    }
  } else {
    const termStem = stem(normalizedTerm);
    const words = normalizedOutput.split(/\s+/);
    const stemmedWords = words.map((w) => stem(w.replace(/[^a-zA-Z]/g, '')));
    if (stemmedWords.some((w) => w === termStem || w.includes(termStem))) {
      return {
        pass: true,
        message: `Output mentions "${term}" (stemmed).`,
        tier: 2,
        diagnostic: { expected: term, received: `stemmed match for "${termStem}"`, tokens: 0 },
      };
    }
  }

  const result: MatcherResult = {
    pass: false,
    message: `Output does not mention "${term}"${options?.stem ? ' (stemmed)' : ''}.`,
    tier: 2,
    diagnostic: {
      expected: term,
      received: `No match in ${output.length} characters`,
      tokens: 0,
    },
  };
  if (output.length > 200) {
    result.diagnostic.suggestion = `Output preview: "${output.slice(0, 200)}…"`;
  }
  return result;
}

export function toContainAll(output: string, patterns: (string | RegExp)[]): MatcherResult {
  const missing: string[] = [];

  for (const pattern of patterns) {
    const matches = pattern instanceof RegExp ? pattern.test(output) : output.includes(pattern);
    if (!matches) {
      missing.push(pattern instanceof RegExp ? pattern.toString() : pattern);
    }
  }

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Output is missing ${missing.length} pattern(s): ${missing.join(', ')}`,
      tier: 2,
      diagnostic: {
        expected: patterns.map((p) => (p instanceof RegExp ? p.toString() : p)),
        received: `Missing: [${missing.join(', ')}]`,
        suggestion: `Missing patterns: ${missing.join(', ')}`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: 'Output contains all patterns.',
    tier: 2,
    diagnostic: { expected: patterns.length, received: patterns.length, tokens: 0 },
  };
}

export function toContainAny(output: string, patterns: (string | RegExp)[]): MatcherResult {
  for (const pattern of patterns) {
    const matches = pattern instanceof RegExp ? pattern.test(output) : output.includes(pattern);
    if (matches) {
      return {
        pass: true,
        message: 'Output contains at least one pattern.',
        tier: 2,
        diagnostic: {
          expected: 'at least one match',
          received: pattern instanceof RegExp ? pattern.toString() : pattern,
          tokens: 0,
        },
      };
    }
  }

  return {
    pass: false,
    message: 'Output does not contain any of the expected patterns.',
    tier: 2,
    diagnostic: {
      expected: patterns.map((p) => (p instanceof RegExp ? p.toString() : p)),
      received: 'No matches',
      suggestion: `None of the ${patterns.length} patterns matched: [${patterns.map((p) => (p instanceof RegExp ? p.toString() : `"${p}"`)).join(', ')}]`,
      tokens: 0,
    },
  };
}
