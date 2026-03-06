import { BUILTIN_RULES } from './builtin-rules.js';
import type { RedactionConfig, RedactionRule } from './types.js';

export class RedactionPipeline {
  private readonly rules: RedactionRule[];

  constructor(config?: RedactionConfig) {
    this.rules = [...BUILTIN_RULES];
    if (config?.rules) {
      this.rules.push(...config.rules);
    }
    if (config?.redactEnvValues) {
      for (const envName of config.redactEnvValues) {
        const value = process.env[envName];
        if (value && value.length > 0) {
          this.rules.push({
            pattern: new RegExp(escapeRegex(value), 'g'),
            replacement: `[REDACTED_ENV:${envName}]`,
          });
        }
      }
    }
  }

  redact(input: string): string {
    let result = input;
    for (const rule of this.rules) {
      rule.pattern.lastIndex = 0;
      result = result.replace(rule.pattern, rule.replacement);
    }
    return result;
  }

  redactObject<T>(obj: T): T {
    return JSON.parse(this.redact(JSON.stringify(obj)));
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
