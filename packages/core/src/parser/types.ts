export interface ParsedSkill {
  readonly frontmatter: SkillFrontmatter;
  readonly body: string;
  readonly hash: string;
  readonly parseWarnings: string[];
  readonly filePath: string;
}

export interface SkillFrontmatter {
  readonly name: string;
  readonly description?: string;
  readonly triggers?: readonly string[];
  readonly excludes?: readonly string[];
  readonly tools?: readonly string[];
  readonly [key: string]: unknown;
}

export const KNOWN_FRONTMATTER_FIELDS = new Set([
  // TracePact native
  'name',
  'description',
  'triggers',
  'excludes',
  'tools',
  // skills.sh ecosystem
  'version',
  'license',
  'metadata',
  'user-invocable',
]);
