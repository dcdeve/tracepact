import type { WriteCapture } from '../../sandbox/types.js';
import type { ToolTrace } from '../../trace/types.js';
import type { MatcherResult } from '../types.js';
import { extractJson } from '../utils/json-extractor.js';
import { tokenizeMarkdown } from '../utils/markdown-tokenizer.js';

interface MarkdownSpec {
  headings?: Array<{ level?: number; text?: string | RegExp }>;
  codeBlocks?: { min?: number; lang?: string };
  lists?: { min?: number };
}

export function toHaveMarkdownStructure(output: string, spec: MarkdownSpec): MatcherResult {
  const structure = tokenizeMarkdown(output);
  const failures: string[] = [];

  if (spec.headings) {
    for (const expected of spec.headings) {
      const match = structure.headings.find((h) => {
        if (expected.level != null && h.level !== expected.level) return false;
        if (expected.text instanceof RegExp) return expected.text.test(h.text);
        if (typeof expected.text === 'string') return h.text.includes(expected.text);
        return true;
      });
      if (!match) {
        const desc = expected.level ? `H${expected.level}` : 'heading';
        const textDesc = expected.text ? ` matching ${expected.text}` : '';
        let msg = `Missing ${desc}${textDesc}`;

        if (expected.text) {
          const wrongLevel = structure.headings.find((h) => {
            if (expected.text instanceof RegExp) return expected.text.test(h.text);
            return h.text.includes(expected.text as string);
          });
          if (wrongLevel && wrongLevel.level !== expected.level) {
            msg += `. Found "${wrongLevel.text}" at H${wrongLevel.level} — did you mean { level: ${wrongLevel.level} }?`;
          }
        }
        failures.push(msg);
      }
    }
  }

  if (spec.codeBlocks) {
    const filtered = spec.codeBlocks.lang
      ? structure.codeBlocks.filter((b) => b.lang === spec.codeBlocks?.lang)
      : structure.codeBlocks;
    const min = spec.codeBlocks.min ?? 1;
    if (filtered.length < min) {
      failures.push(
        `Expected ≥${min} code block(s)${spec.codeBlocks.lang ? ` with lang="${spec.codeBlocks.lang}"` : ''}, found ${filtered.length}.`
      );
    }
  }

  if (spec.lists) {
    const min = spec.lists.min ?? 1;
    if (structure.lists.length < min) {
      failures.push(`Expected ≥${min} list(s), found ${structure.lists.length}.`);
    }
  }

  if (failures.length > 0) {
    return {
      pass: false,
      message: `Markdown structure mismatch: ${failures[0]}`,
      tier: 1,
      diagnostic: {
        expected: spec,
        received: {
          headings: structure.headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`),
          codeBlocks: structure.codeBlocks.length,
          lists: structure.lists.length,
        },
        suggestion: failures.join('\n'),
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: 'Markdown structure matches.',
    tier: 1,
    diagnostic: { expected: spec, received: spec, tokens: 0 },
  };
}

interface JsonSchemaSpec {
  /** Zod-compatible: schema.safeParse(data) → { success, error? } */
  safeParse?: (data: unknown) => {
    success: boolean;
    error?: { issues?: Array<{ path?: unknown[]; message?: string }> };
  };
  /** Legacy: schema.parse(data) → { success, error? } */
  parse?: (data: unknown) => {
    success: boolean;
    error?: { issues?: Array<{ path?: unknown[]; message?: string }> };
  };
}

export function toMatchJsonSchema(output: string, schema: JsonSchemaSpec): MatcherResult {
  const extracted = extractJson(output);

  if (!extracted) {
    return {
      pass: false,
      message: 'No JSON block found in output.',
      tier: 1,
      diagnostic: {
        expected: 'Valid JSON matching schema',
        received: 'No JSON found',
        suggestion:
          output.length > 200
            ? `Output preview: "${output.slice(0, 200)}…"`
            : `Output: "${output}"`,
        tokens: 0,
      },
    };
  }

  // Prefer safeParse (Zod standard), fall back to parse
  const validate = schema.safeParse?.bind(schema) ?? schema.parse?.bind(schema);
  if (!validate) {
    return {
      pass: false,
      message: 'Schema must have a safeParse() or parse() method (e.g. a Zod schema).',
      tier: 1,
      diagnostic: { expected: 'schema with safeParse/parse', received: typeof schema, tokens: 0 },
    };
  }
  const result = validate(extracted.json);
  if (!result.success) {
    const issues = result.error?.issues ?? [];
    const details = issues.map((i) => `${i.path?.join('.') ?? '(root)'}: ${i.message}`).join('; ');
    return {
      pass: false,
      message: `JSON does not match schema: ${details}`,
      tier: 1,
      diagnostic: {
        expected: 'Valid JSON matching schema',
        received: extracted.json,
        suggestion: details,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: 'JSON matches schema.',
    tier: 1,
    diagnostic: { expected: 'schema match', received: extracted.json, tokens: 0 },
  };
}

interface LineCountSpec {
  min?: number;
  max?: number;
  exact?: number;
}

export function toHaveLineCount(output: string, spec: LineCountSpec): MatcherResult {
  const count = output.split('\n').length;

  if (spec.exact != null && count !== spec.exact) {
    return {
      pass: false,
      message: `Expected exactly ${spec.exact} lines, got ${count}.`,
      tier: 1,
      diagnostic: {
        expected: spec.exact,
        received: count,
        suggestion: `Output has ${count} lines.`,
        tokens: 0,
      },
    };
  }

  if (spec.min != null && count < spec.min) {
    return {
      pass: false,
      message: `Expected ≥${spec.min} lines, got ${count}.`,
      tier: 1,
      diagnostic: {
        expected: { min: spec.min },
        received: count,
        suggestion: `Output has ${count} lines, need at least ${spec.min}.`,
        tokens: 0,
      },
    };
  }

  if (spec.max != null && count > spec.max) {
    return {
      pass: false,
      message: `Expected ≤${spec.max} lines, got ${count}.`,
      tier: 1,
      diagnostic: {
        expected: { max: spec.max },
        received: count,
        suggestion: `Output has ${count} lines, need at most ${spec.max}.`,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `Line count ${count} is within range.`,
    tier: 1,
    diagnostic: { expected: spec, received: count, tokens: 0 },
  };
}

export function toHaveFileWritten(
  writesOrTrace: ReadonlyArray<WriteCapture> | ToolTrace,
  path: string,
  contentMatcher?: string | RegExp
): MatcherResult {
  // Accept both WriteCapture[] and ToolTrace — extract writes from trace if needed
  const isTrace = !Array.isArray(writesOrTrace) && 'calls' in writesOrTrace;
  const writes: ReadonlyArray<WriteCapture> = isTrace
    ? (writesOrTrace as ToolTrace).calls
        .filter(
          (c: { toolName: string; result: { type: string }; args: Record<string, unknown> }) =>
            c.toolName === 'write_file' &&
            c.result.type === 'success' &&
            typeof c.args.path === 'string'
        )
        .map((c: { args: Record<string, unknown> }) => ({
          path: c.args.path as string,
          content: String(c.args.content ?? ''),
        }))
    : (writesOrTrace as ReadonlyArray<WriteCapture>);
  const found = writes.find((w) => w.path === path);

  if (!found) {
    const written = writes.map((w) => w.path);
    return {
      pass: false,
      message: `Expected file "${path}" to be written, but it was not.`,
      tier: 1,
      diagnostic: {
        expected: path,
        received: written.length > 0 ? written : '(no files written)',
        suggestion:
          written.length > 0 ? `Files written: [${written.join(', ')}]` : 'No files were written.',
        tokens: 0,
      },
    };
  }

  if (contentMatcher) {
    const matches =
      contentMatcher instanceof RegExp
        ? contentMatcher.test(found.content)
        : found.content.includes(contentMatcher);

    if (!matches) {
      const preview =
        found.content.length > 200 ? `${found.content.slice(0, 200)}…` : found.content;
      return {
        pass: false,
        message: `File "${path}" was written but content does not match.`,
        tier: 1,
        diagnostic: {
          expected: contentMatcher instanceof RegExp ? contentMatcher.toString() : contentMatcher,
          received: preview,
          suggestion: `Content preview: "${preview}"`,
          tokens: 0,
        },
      };
    }
  }

  return {
    pass: true,
    message: `File "${path}" was written.`,
    tier: 1,
    diagnostic: { expected: path, received: path, tokens: 0 },
  };
}
