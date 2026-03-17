import { BUILTIN_RULES } from './builtin-rules.js';
import type { RedactionConfig, RedactionRule } from './types.js';

const SECRET_ENV_PATTERN = /(_API_KEY|_TOKEN|_SECRET|_PASSWORD|_CREDENTIAL|_PRIVATE_KEY)$/i;

const WELL_KNOWN_SECRET_PREFIXES = ['ANTHROPIC_', 'OPENAI_', 'COHERE_', 'GEMINI_'];

function isSecretEnvName(name: string): boolean {
  if (SECRET_ENV_PATTERN.test(name)) return true;
  return WELL_KNOWN_SECRET_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export class RedactionPipeline {
  private readonly rules: RedactionRule[];

  constructor(config?: RedactionConfig) {
    this.rules = [...BUILTIN_RULES];
    if (config?.rules) {
      this.rules.push(...config.rules);
    }

    // Collect env var names to redact: explicit config + auto-detected secrets.
    const explicitNames = new Set(config?.redactEnvValues ?? []);
    const autoDetectedNames = Object.keys(process.env).filter(
      (name) => !explicitNames.has(name) && isSecretEnvName(name)
    );
    const allEnvNames = [...explicitNames, ...autoDetectedNames];

    for (const envName of allEnvNames) {
      const value = process.env[envName];
      if (value && value.length > 0) {
        this.rules.push({
          pattern: new RegExp(escapeRegex(value), 'g'),
          replacement: `[REDACTED_ENV:${envName}]`,
        });
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
