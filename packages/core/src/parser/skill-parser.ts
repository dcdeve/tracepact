import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { SkillParseError } from '../errors/parse-error.js';
import { log } from '../logger.js';
import { validateFrontmatter } from './frontmatter-validator.js';
import type { ParsedSkill } from './types.js';

export async function parseSkill(filePath: string): Promise<ParsedSkill> {
  const absPath = resolve(filePath);
  let raw: string;
  try {
    raw = await readFile(absPath, 'utf-8');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new SkillParseError(absPath, 'File not found.');
    }
    throw new SkillParseError(absPath, `Cannot read file: ${err.message}`);
  }

  if (raw.trim() === '') {
    throw new SkillParseError(absPath, 'SKILL.md is empty.');
  }

  if (raw.includes('\uFFFD')) {
    throw new SkillParseError(absPath, 'File is not valid UTF-8.');
  }

  if (!raw.startsWith('---')) {
    throw new SkillParseError(
      absPath,
      'Missing YAML frontmatter. Expected file to begin with ---.',
      1
    );
  }

  const secondDelimiter = raw.indexOf('\n---', 3);
  if (secondDelimiter === -1) {
    throw new SkillParseError(absPath, 'Unclosed YAML frontmatter. Expected a closing ---.', 1);
  }

  const yamlContent = raw.slice(4, secondDelimiter);
  const bodyStart = secondDelimiter + 4;
  const body = raw.slice(bodyStart).trim();

  let frontmatterRaw: unknown;
  try {
    frontmatterRaw = parseYaml(yamlContent);
  } catch (err: any) {
    const line = err.linePos?.[0]?.line;
    throw new SkillParseError(
      absPath,
      `Invalid YAML in frontmatter: ${err.message}`,
      line ? line + 1 : undefined
    );
  }

  const { frontmatter, warnings } = validateFrontmatter(absPath, frontmatterRaw);

  if (raw.length > 1_048_576) {
    log.warn(`${absPath}: File is >1MB (${raw.length} bytes). Parsing anyway.`);
  }

  const hash = createHash('sha256').update(raw).digest('hex');
  return { frontmatter, body, hash, parseWarnings: warnings, filePath: absPath };
}
