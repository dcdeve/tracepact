import { describe, expect, it } from 'vitest';
import { extractJson } from '../../src/matchers/utils/json-extractor.js';
import { tokenizeMarkdown } from '../../src/matchers/utils/markdown-tokenizer.js';
import { stem } from '../../src/matchers/utils/stemmer.js';

describe('tokenizeMarkdown', () => {
  it('extracts headings', () => {
    const r = tokenizeMarkdown('# Title\n## Subtitle\n### Deep');
    expect(r.headings).toHaveLength(3);
    expect(r.headings[0]).toEqual({ level: 1, text: 'Title', line: 0 });
    expect(r.headings[1]).toEqual({ level: 2, text: 'Subtitle', line: 1 });
  });

  it('extracts code blocks with lang', () => {
    const r = tokenizeMarkdown('```typescript\nconst x = 1;\n```');
    expect(r.codeBlocks).toHaveLength(1);
    expect(r.codeBlocks[0].lang).toBe('typescript');
    expect(r.codeBlocks[0].content).toBe('const x = 1;');
  });

  it('extracts code blocks without lang', () => {
    const r = tokenizeMarkdown('```\nhello\n```');
    expect(r.codeBlocks[0].lang).toBeNull();
  });

  it('extracts unordered lists', () => {
    const r = tokenizeMarkdown('- a\n- b\n- c');
    expect(r.lists).toHaveLength(1);
    expect(r.lists[0].type).toBe('unordered');
    expect(r.lists[0].itemCount).toBe(3);
  });

  it('extracts ordered lists', () => {
    const r = tokenizeMarkdown('1. first\n2. second');
    expect(r.lists).toHaveLength(1);
    expect(r.lists[0].type).toBe('ordered');
    expect(r.lists[0].itemCount).toBe(2);
  });

  it('ignores headings inside code blocks', () => {
    const r = tokenizeMarkdown('```\n# Not a heading\n```\n# Real heading');
    expect(r.headings).toHaveLength(1);
    expect(r.headings[0].text).toBe('Real heading');
  });
});

describe('extractJson', () => {
  it('extracts from fenced block', () => {
    const r = extractJson('Text\n```json\n{"key": "value"}\n```\nMore');
    expect(r).not.toBeNull();
    expect((r?.json as any).key).toBe('value');
  });

  it('extracts raw JSON object', () => {
    const r = extractJson('Result: {"name": "test"}');
    expect(r).not.toBeNull();
    expect((r?.json as any).name).toBe('test');
  });

  it('extracts raw JSON array', () => {
    const r = extractJson('List: [1, 2, 3]');
    expect(r).not.toBeNull();
    expect(r?.json).toEqual([1, 2, 3]);
  });

  it('returns null for no JSON', () => {
    expect(extractJson('No JSON here')).toBeNull();
  });
});

describe('stem (Porter Stemmer)', () => {
  it('stems plurals', () => {
    expect(stem('cats')).toBe('cat');
    expect(stem('ponies')).toBe('poni');
  });

  it('stems -ing forms', () => {
    expect(stem('running')).toBe('run');
    expect(stem('jumping')).toBe('jump');
  });

  it('stems -ed forms', () => {
    expect(stem('jumped')).toBe('jump');
  });

  it('stems -ation/-ize suffixes', () => {
    expect(stem('generalization')).toBe('gener');
    expect(stem('parameterize')).toBe('parameter');
  });

  it('handles short words', () => {
    expect(stem('a')).toBe('a');
    expect(stem('go')).toBe('go');
  });

  it('stems consistently: parameterized and parameterize match', () => {
    expect(stem('parameterized')).toBe(stem('parameterize'));
  });

  it('stems consistently: running and run match', () => {
    expect(stem('running')).toBe(stem('run'));
  });
});
