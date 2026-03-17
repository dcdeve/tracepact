import { BUILTIN_RULES } from './builtin-rules.js';
import type { RedactionConfig, RedactionRule } from './types.js';

const SECRET_ENV_PATTERN = /(_API_KEY|_TOKEN|_SECRET|_PASSWORD|_CREDENTIAL|_PRIVATE_KEY|_PASS)$/i;

const WELL_KNOWN_SECRET_PREFIXES = ['ANTHROPIC_', 'OPENAI_', 'COHERE_', 'GEMINI_'];

// Env var names that are never secrets regardless of value length/entropy.
const SAFE_ENV_NAMES = new Set([
  'PATH',
  'HOME',
  'SHELL',
  'USER',
  'LOGNAME',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'PWD',
  'OLDPWD',
  'TERM',
  'TERM_PROGRAM',
  'COLORTERM',
  'TMPDIR',
  'TEMP',
  'TMP',
  'EDITOR',
  'VISUAL',
  'PAGER',
  'MANPATH',
  'INFOPATH',
  'XDG_DATA_DIRS',
  'XDG_CONFIG_DIRS',
  'XDG_RUNTIME_DIR',
  'DBUS_SESSION_BUS_ADDRESS',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'HOSTNAME',
  'HOSTTYPE',
  'MACHTYPE',
  'OSTYPE',
  'NODE_ENV',
  'NODE_PATH',
  'npm_lifecycle_event',
  'npm_package_name',
]);

function isSecretEnvName(name: string): boolean {
  if (SECRET_ENV_PATTERN.test(name)) return true;
  return WELL_KNOWN_SECRET_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Returns true when a value looks like an opaque secret regardless of the
 * env var name that holds it.  Criteria (all must be true):
 *   - No whitespace (rules out paths, sentences, colon-separated lists)
 *   - Length >= 20 characters
 *   - Contains at least one digit or non-alphanumeric character (rules out
 *     plain lowercase/uppercase words like "production" or "America/New_York")
 */
function looksLikeSecretValue(value: string): boolean {
  if (/\s/.test(value)) return false;
  if (value.length < 20) return false;
  // Must contain at least one digit or symbol to avoid flagging locale strings
  // like "America/Los_Angeles" — those have underscores but no digits/symbols.
  // We still want to catch base64, JWT, hex tokens, etc.
  return /[0-9!@#$%^&*+=]/.test(value);
}

export class RedactionPipeline {
  private readonly rules: RedactionRule[];

  constructor(config?: RedactionConfig) {
    this.rules = [...BUILTIN_RULES];
    if (config?.rules) {
      this.rules.push(...config.rules);
    }

    // Collect env var names to redact:
    //   1. Explicit names from config (always included).
    //   2. Names that match known secret name patterns.
    //   3. Names whose values look like opaque secrets by heuristic
    //      (length + entropy proxy), even if the name is non-standard.
    const explicitNames = new Set(config?.redactEnvValues ?? []);
    const autoDetectedNames = Object.keys(process.env).filter((name) => {
      if (explicitNames.has(name)) return false;
      if (isSecretEnvName(name)) return true;
      if (SAFE_ENV_NAMES.has(name)) return false;
      const value = process.env[name];
      return value !== undefined && looksLikeSecretValue(value);
    });
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
    return redactValue(obj, (s) => this.redact(s)) as T;
  }
}

/**
 * Recursively walks a JSON-compatible value and applies `redact` to every
 * string leaf.  Returns a new value (deep clone) — the original is never
 * mutated.  Avoids the double JSON.stringify/parse round-trip that running
 * regexes over a serialized string would require.
 */
function redactValue(value: unknown, redact: (s: string) => string): unknown {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, redact));
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      result[key] = redactValue((value as Record<string, unknown>)[key], redact);
    }
    return result;
  }
  // Primitives (number, boolean, null, undefined) pass through unchanged.
  return value;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
