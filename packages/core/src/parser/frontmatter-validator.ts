import { SkillParseError } from '../errors/parse-error.js';
import { KNOWN_FRONTMATTER_FIELDS, type SkillFrontmatter } from './types.js';

export function validateFrontmatter(
  filePath: string,
  raw: unknown
): { frontmatter: SkillFrontmatter; warnings: string[] } {
  const warnings: string[] = [];

  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SkillParseError(
      filePath,
      `Frontmatter must be a YAML object (got ${
        raw == null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw
      }).`
    );
  }

  const obj = raw as Record<string, unknown>;

  if (!('name' in obj) || typeof obj.name !== 'string' || obj.name.trim() === '') {
    throw new SkillParseError(filePath, 'Frontmatter must include a non-empty `name` field.');
  }

  if ('triggers' in obj) {
    if (!Array.isArray(obj.triggers) || !obj.triggers.every((t) => typeof t === 'string')) {
      throw new SkillParseError(filePath, '`triggers` must be an array of strings.');
    }
  }

  if ('excludes' in obj) {
    if (!Array.isArray(obj.excludes) || !obj.excludes.every((e) => typeof e === 'string')) {
      throw new SkillParseError(filePath, '`excludes` must be an array of strings.');
    }
  }

  if ('tools' in obj) {
    if (!Array.isArray(obj.tools) || !obj.tools.every((t) => typeof t === 'string')) {
      throw new SkillParseError(filePath, '`tools` must be an array of strings.');
    }
  }

  for (const key of Object.keys(obj)) {
    if (!KNOWN_FRONTMATTER_FIELDS.has(key)) {
      warnings.push(
        `Unknown frontmatter field: "${key}". This may be intentional (forward compatibility).`
      );
    }
  }

  return { frontmatter: obj as unknown as SkillFrontmatter, warnings };
}
