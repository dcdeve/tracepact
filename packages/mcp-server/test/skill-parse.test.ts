import { join } from 'node:path';
import { parseSkill } from '@tracepact/core';
import { describe, expect, it } from 'vitest';

describe('SKILL.md propio', () => {
  it('parses the project SKILL.md', async () => {
    const skillPath = join(import.meta.dirname, '../../../SKILL.md');
    const skill = await parseSkill(skillPath);

    expect(skill.frontmatter.name).toBe('tracepact');
    expect(skill.frontmatter.tools).toBeDefined();
    expect(skill.frontmatter.tools?.length).toBeGreaterThanOrEqual(6);
    expect(skill.body).toContain('Audit');
  });
});
