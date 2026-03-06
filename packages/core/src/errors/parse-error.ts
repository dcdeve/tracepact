import { TracepactError } from './base.js';

export class SkillParseError extends TracepactError {
  readonly filePath: string;
  readonly line: number | undefined;

  constructor(filePath: string, message: string, line?: number) {
    const loc = line != null ? `:${line}` : '';
    super('SKILL_PARSE_ERROR', `${filePath}${loc}: ${message}`);
    this.name = 'SkillParseError';
    this.filePath = filePath;
    this.line = line;
  }
}
