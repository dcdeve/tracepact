import { TracepactError } from './base.js';

export class ConfigError extends TracepactError {
  readonly field: string;

  constructor(field: string, message: string) {
    super('CONFIG_ERROR', `Configuration error at "${field}": ${message}`);
    this.name = 'ConfigError';
    this.field = field;
  }
}
