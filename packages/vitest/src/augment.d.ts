import 'vitest';

interface CustomMatchers<R = unknown> {
  // Tier 0
  toHaveCalledTool(name: string, args?: Record<string, unknown>): R;
  toNotHaveCalledTool(name: string): R;
  toHaveCalledToolsInOrder(names: string[]): R;
  toHaveCalledToolsInStrictOrder(names: string[]): R;
  toHaveToolCallCount(name: string, count: number): R;
  toHaveFirstCalledTool(name: string): R;
  toHaveLastCalledTool(name: string): R;

  // Tier 1
  toHaveMarkdownStructure(spec: {
    headings?: Array<{ level?: number; text?: string | RegExp }>;
    codeBlocks?: { min?: number; lang?: string };
    lists?: { min?: number };
  }): R;
  toMatchJsonSchema(schema: { parse: (data: unknown) => { success: boolean; error?: unknown } }): R;
  toHaveLineCount(spec: { min?: number; max?: number; exact?: number }): R;
  toHaveFileWritten(path: string, contentMatcher?: string | RegExp): R;

  // Tier 2
  toContain(pattern: string | RegExp): R;
  toMention(term: string, options?: { stem?: boolean }): R;
  toNotContain(pattern: string | RegExp): R;
  toContainAll(patterns: (string | RegExp)[]): R;
  toContainAny(patterns: (string | RegExp)[]): R;

  // Tier 3
  toBeSemanticallySimilar(
    reference: string,
    options: import('@tracepact/core').SemanticSimilarityOptions
  ): R;
  toHaveSemanticOverlap(
    topics: string[],
    options: import('@tracepact/core').SemanticOverlapOptions
  ): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
