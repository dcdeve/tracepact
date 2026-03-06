import { describe, expect, it } from 'vitest';
import {
  toHaveFileWritten,
  toHaveLineCount,
  toHaveMarkdownStructure,
  toMatchJsonSchema,
} from '../../src/matchers/tier1/index.js';

const sampleMarkdown = `# Title

Some text here.

## Section One

- item 1
- item 2
- item 3

\`\`\`typescript
const x = 1;
\`\`\`

1. first
2. second
`;

describe('toHaveMarkdownStructure', () => {
  it('passes when H1 present', () => {
    expect(toHaveMarkdownStructure(sampleMarkdown, { headings: [{ level: 1 }] }).pass).toBe(true);
  });

  it('fails when H1 missing, suggests H2', () => {
    const md = '## Only H2\nSome text';
    const r = toHaveMarkdownStructure(md, { headings: [{ level: 1, text: 'Only H2' }] });
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('H2');
  });

  it('passes with code block lang match', () => {
    expect(
      toHaveMarkdownStructure(sampleMarkdown, { codeBlocks: { lang: 'typescript' } }).pass
    ).toBe(true);
  });

  it('fails with wrong code block lang', () => {
    const r = toHaveMarkdownStructure(sampleMarkdown, { codeBlocks: { lang: 'python' } });
    expect(r.pass).toBe(false);
  });

  it('passes when lists present', () => {
    expect(toHaveMarkdownStructure(sampleMarkdown, { lists: { min: 1 } }).pass).toBe(true);
  });
});

describe('toMatchJsonSchema', () => {
  const schema = {
    parse: (data: unknown) => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'name' in data &&
        typeof (data as any).name === 'string'
      ) {
        return { success: true as const };
      }
      return {
        success: false as const,
        error: { issues: [{ path: ['name'], message: 'Expected string' }] },
      };
    },
  };

  it('passes with valid JSON matching schema', () => {
    const output = 'Here is the result:\n```json\n{"name": "test"}\n```';
    expect(toMatchJsonSchema(output, schema).pass).toBe(true);
  });

  it('fails when JSON violates schema', () => {
    const output = '```json\n{"name": 123}\n```';
    const r = toMatchJsonSchema(output, schema);
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('name');
  });

  it('fails when no JSON in output', () => {
    const r = toMatchJsonSchema('No JSON here', schema);
    expect(r.pass).toBe(false);
    expect(r.message).toContain('No JSON block found');
  });

  it('extracts JSON from fenced block', () => {
    const output = 'Some text\n```json\n{"name": "hello"}\n```\nMore text';
    expect(toMatchJsonSchema(output, schema).pass).toBe(true);
  });
});

describe('toHaveLineCount', () => {
  it('passes with exact match', () => {
    expect(toHaveLineCount('a\nb\nc', { exact: 3 }).pass).toBe(true);
  });

  it('fails when out of range', () => {
    const r = toHaveLineCount('a\nb', { exact: 5 });
    expect(r.pass).toBe(false);
    expect(r.diagnostic.received).toBe(2);
  });
});

describe('toHaveFileWritten', () => {
  const writes = [
    { path: 'src/main.ts', content: 'export const x = 1;' },
    { path: 'README.md', content: '# Hello' },
  ];

  it('passes when file was written', () => {
    expect(toHaveFileWritten(writes, 'src/main.ts').pass).toBe(true);
  });

  it('fails when file not written', () => {
    const r = toHaveFileWritten(writes, 'package.json');
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('src/main.ts');
  });

  it('passes when content matches regex', () => {
    expect(toHaveFileWritten(writes, 'src/main.ts', /export/).pass).toBe(true);
  });

  it('fails when content mismatches', () => {
    const r = toHaveFileWritten(writes, 'src/main.ts', 'import');
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('Content preview');
  });
});
