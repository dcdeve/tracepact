import { log } from '../logger.js';
import { TraceBuilder } from '../trace/trace-builder.js';
import type { ToolCallSource, ToolResult, ToolTrace } from '../trace/types.js';
import type { MockToolDefs, MockToolEntry, MockToolImpl, WriteCapture } from './types.js';

export interface MockSandboxOptions {
  /**
   * When true, args are validated against the JSON schema declared in
   * MockToolEntry definitions before the impl is called. Tools registered
   * as plain functions (no schema) are not affected.
   * Defaults to false for backward compatibility.
   */
  strict?: boolean;
}

function isMockToolEntry(val: MockToolImpl | MockToolEntry): val is MockToolEntry {
  return typeof val === 'object' && val !== null && 'impl' in val && 'schema' in val;
}

/**
 * Validate a single value against a JSON Schema property schema.
 * Returns an error message string, or null if valid.
 * Supports: type, enum, minLength, maxLength, pattern, items (array), and nested object properties.
 */
function validateValue(
  path: string,
  val: unknown,
  propSchema: Record<string, unknown>
): string | null {
  const expectedType = propSchema.type as string | undefined;

  if (expectedType) {
    let typeError: string | null = null;
    if (expectedType === 'array') {
      if (!Array.isArray(val)) {
        typeError = `Argument '${path}' must be of type array, got ${val === null ? 'null' : typeof val}.`;
      }
    } else if (expectedType === 'object') {
      if (val === null || typeof val !== 'object' || Array.isArray(val)) {
        typeError = `Argument '${path}' must be of type object, got ${Array.isArray(val) ? 'array' : val === null ? 'null' : typeof val}.`;
      }
    } else if (expectedType === 'integer') {
      if (typeof val !== 'number' || !Number.isInteger(val)) {
        typeError = `Argument '${path}' must be an integer, got ${typeof val}.`;
      }
    } else {
      // string, number, boolean
      const actualType = typeof val;
      if (actualType !== expectedType) {
        typeError = `Argument '${path}' must be of type ${expectedType}, got ${actualType}.`;
      }
    }
    if (typeError) return typeError;
  }

  // enum constraint
  const enumValues = propSchema.enum;
  if (Array.isArray(enumValues) && !enumValues.includes(val)) {
    return `Argument '${path}' must be one of [${enumValues.map((v) => JSON.stringify(v)).join(', ')}], got ${JSON.stringify(val)}.`;
  }

  // string constraints
  if (typeof val === 'string') {
    const minLength = propSchema.minLength as number | undefined;
    if (minLength !== undefined && val.length < minLength) {
      return `Argument '${path}' must have at least ${minLength} character(s), got ${val.length}.`;
    }
    const maxLength = propSchema.maxLength as number | undefined;
    if (maxLength !== undefined && val.length > maxLength) {
      return `Argument '${path}' must have at most ${maxLength} character(s), got ${val.length}.`;
    }
    const pattern = propSchema.pattern as string | undefined;
    if (pattern !== undefined && !new RegExp(pattern).test(val)) {
      return `Argument '${path}' does not match required pattern /${pattern}/.`;
    }
  }

  // recurse into nested object properties
  if (expectedType === 'object' && typeof val === 'object' && val !== null && !Array.isArray(val)) {
    const nestedError = validateObjectProperties(val as Record<string, unknown>, propSchema, path);
    if (nestedError) return nestedError;
  }

  // recurse into array items
  if (expectedType === 'array' && Array.isArray(val)) {
    const itemsSchema = propSchema.items as Record<string, unknown> | undefined;
    if (itemsSchema) {
      for (let i = 0; i < val.length; i++) {
        const itemError = validateValue(`${path}[${i}]`, val[i], itemsSchema);
        if (itemError) return itemError;
      }
    }
  }

  return null;
}

/**
 * Validate required fields and properties of an object against a JSON Schema object-schema.
 * Returns an error message string, or null if valid.
 */
function validateObjectProperties(
  obj: Record<string, unknown>,
  schema: Record<string, unknown>,
  pathPrefix = ''
): string | null {
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  for (const key of required) {
    if (!(key in obj) || obj[key] === undefined) {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      return `Missing required argument: '${path}'.`;
    }
  }

  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (properties) {
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!(key in obj)) continue;
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      const err = validateValue(path, obj[key], propSchema);
      if (err) return err;
    }
  }

  return null;
}

/**
 * Validate args against a JSON Schema object-schema.
 * Enforces: required fields, type checks, enum, minLength, maxLength, pattern, items,
 * and recurses into nested object properties.
 * Returns an error message string, or null if valid.
 */
function validateArgs(
  args: Record<string, unknown>,
  schema: Record<string, unknown>
): string | null {
  if (schema.type !== 'object') return null;
  return validateObjectProperties(args, schema);
}

export class MockSandbox {
  private readonly tools: MockToolDefs;
  private readonly sources: Record<string, ToolCallSource>;
  private readonly traceBuilder = new TraceBuilder();
  private readonly writes: WriteCapture[] = [];
  private readonly writeToolName: string;
  private readonly strict: boolean;

  constructor(
    tools: MockToolDefs,
    sources?: Record<string, ToolCallSource>,
    writeToolName = 'write_file',
    options: MockSandboxOptions = {}
  ) {
    this.tools = tools;
    this.sources = sources ?? {};
    this.writeToolName = writeToolName;
    this.strict = options.strict ?? false;
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const start = performance.now();
    const entry = this.tools[name];
    let result: ToolResult;
    let unknownTool = false;

    if (!entry) {
      unknownTool = true;
      result = { type: 'error', message: `Unknown tool: '${name}'.` };
      log.warn(`MockSandbox: agent called unknown tool '${name}'.`);
    } else {
      const impl = isMockToolEntry(entry) ? entry.impl : entry;

      if (this.strict && isMockToolEntry(entry)) {
        const validationError = validateArgs(args, entry.schema);
        if (validationError) {
          result = {
            type: 'error',
            message: `Schema validation failed for tool '${name}': ${validationError}`,
          };
          const durationMs = performance.now() - start;
          const source = this.sources[name];
          if (source) {
            this.traceBuilder.addCall({
              toolName: name,
              args,
              result,
              durationMs,
              unknownTool,
              source,
            });
          } else {
            this.traceBuilder.addCall({ toolName: name, args, result, durationMs, unknownTool });
          }
          return result;
        }
      }

      try {
        result = await impl(args);
      } catch (err: any) {
        log.error(`MockSandbox: tool '${name}' threw an error.`, err);
        result = { type: 'error', message: `Mock threw: ${err.message}` };
      }
    }

    const durationMs = performance.now() - start;
    const source = this.sources[name];
    if (source) {
      this.traceBuilder.addCall({ toolName: name, args, result, durationMs, unknownTool, source });
    } else {
      this.traceBuilder.addCall({ toolName: name, args, result, durationMs, unknownTool });
    }

    if (name === this.writeToolName && result.type === 'success' && typeof args.path === 'string') {
      this.writes.push({ path: args.path, content: String(args.content ?? '') });
    }

    return result;
  }

  getTrace(): ToolTrace {
    return this.traceBuilder.build();
  }

  getWrites(): readonly WriteCapture[] {
    return this.writes;
  }

  reset(): void {
    this.traceBuilder.reset();
    this.writes.length = 0;
  }
}
