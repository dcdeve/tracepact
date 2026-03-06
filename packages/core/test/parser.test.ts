import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SkillParseError } from '../src/errors/parse-error.js';
import { parseSkill } from '../src/parser/skill-parser.js';

const TMP_DIR = join(import.meta.dirname, '__fixtures__');

async function writeFixture(name: string, content: string): Promise<string> {
  const path = join(TMP_DIR, name);
  await writeFile(path, content, 'utf-8');
  return path;
}

beforeAll(async () => {
  await mkdir(TMP_DIR, { recursive: true });
});

afterAll(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe('parseSkill', () => {
  it('parses a valid minimal SKILL.md', async () => {
    const path = await writeFixture('minimal.md', '---\nname: test\n---\nBody here');
    const result = await parseSkill(path);

    expect(result.frontmatter.name).toBe('test');
    expect(result.body).toBe('Body here');
    expect(result.parseWarnings).toHaveLength(0);
    expect(result.filePath).toBe(path);
    expect(result.hash).toHaveLength(64);
  });

  it('parses a fully populated SKILL.md', async () => {
    const content = [
      '---',
      'name: code-reviewer',
      'description: Reviews code for quality',
      'triggers:',
      '  - review this',
      '  - check code',
      'excludes:',
      '  - test files',
      'tools:',
      '  - read_file',
      '  - bash',
      '---',
      'You are a code reviewer.',
    ].join('\n');
    const path = await writeFixture('full.md', content);
    const result = await parseSkill(path);

    expect(result.frontmatter.name).toBe('code-reviewer');
    expect(result.frontmatter.description).toBe('Reviews code for quality');
    expect(result.frontmatter.triggers).toEqual(['review this', 'check code']);
    expect(result.frontmatter.excludes).toEqual(['test files']);
    expect(result.frontmatter.tools).toEqual(['read_file', 'bash']);
    expect(result.body).toBe('You are a code reviewer.');
  });

  it('throws SkillParseError for nonexistent file', async () => {
    await expect(parseSkill('/nonexistent/SKILL.md')).rejects.toThrow(SkillParseError);
    await expect(parseSkill('/nonexistent/SKILL.md')).rejects.toThrow('File not found');
  });

  it('throws SkillParseError for empty file', async () => {
    const path = await writeFixture('empty.md', '');
    await expect(parseSkill(path)).rejects.toThrow('SKILL.md is empty');
  });

  it('throws SkillParseError for whitespace-only file', async () => {
    const path = await writeFixture('whitespace.md', '   \n  \n  ');
    await expect(parseSkill(path)).rejects.toThrow('SKILL.md is empty');
  });

  it('throws SkillParseError when no frontmatter delimiter', async () => {
    const path = await writeFixture('no-front.md', '# Just markdown\nSome body');
    await expect(parseSkill(path)).rejects.toThrow('Missing YAML frontmatter');
  });

  it('throws SkillParseError for unclosed frontmatter', async () => {
    const path = await writeFixture('unclosed.md', '---\nname: test\nNo closing');
    await expect(parseSkill(path)).rejects.toThrow('Unclosed YAML frontmatter');
  });

  it('throws SkillParseError for invalid YAML', async () => {
    const path = await writeFixture('bad-yaml.md', '---\n: bad: yaml:\n---\nBody');
    await expect(parseSkill(path)).rejects.toThrow('Invalid YAML');
  });

  it('throws SkillParseError when frontmatter is an array', async () => {
    const path = await writeFixture('array.md', '---\n- item1\n- item2\n---\nBody');
    await expect(parseSkill(path)).rejects.toThrow('must be a YAML object (got array)');
  });

  it('throws SkillParseError when name is missing', async () => {
    const path = await writeFixture('no-name.md', '---\ndescription: foo\n---\nBody');
    await expect(parseSkill(path)).rejects.toThrow('non-empty `name`');
  });

  it('throws SkillParseError when triggers is not string[]', async () => {
    const path = await writeFixture('bad-triggers.md', '---\nname: t\ntriggers: single\n---\nBody');
    await expect(parseSkill(path)).rejects.toThrow('`triggers` must be an array');
  });

  it('produces warnings for unknown frontmatter fields', async () => {
    const path = await writeFixture('unknown.md', '---\nname: t\ncustom_field: x\n---\nBody');
    const result = await parseSkill(path);

    expect(result.parseWarnings.length).toBeGreaterThan(0);
    expect(result.parseWarnings[0]).toContain('custom_field');
  });

  it('handles body containing --- delimiters', async () => {
    const content = '---\nname: t\n---\nBody\n---\nMore body';
    const path = await writeFixture('body-dashes.md', content);
    const result = await parseSkill(path);

    expect(result.body).toContain('---');
    expect(result.body).toContain('More body');
  });

  it('produces consistent hash for same content', async () => {
    const content = '---\nname: hash-test\n---\nSome body';
    const path1 = await writeFixture('hash1.md', content);
    const path2 = await writeFixture('hash2.md', content);

    const result1 = await parseSkill(path1);
    const result2 = await parseSkill(path2);
    expect(result1.hash).toBe(result2.hash);

    const expected = createHash('sha256').update(content).digest('hex');
    expect(result1.hash).toBe(expected);
  });

  it('produces different hash for different content', async () => {
    const path1 = await writeFixture('diff1.md', '---\nname: a\n---\nBody A');
    const path2 = await writeFixture('diff2.md', '---\nname: b\n---\nBody B');

    const result1 = await parseSkill(path1);
    const result2 = await parseSkill(path2);
    expect(result1.hash).not.toBe(result2.hash);
  });
});
