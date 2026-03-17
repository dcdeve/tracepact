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
 * Validate args against a JSON Schema object-schema.
 * Only enforces: required fields present, and (for primitive types) basic type checks.
 * Returns an error message string, or null if valid.
 */
function validateArgs(
  args: Record<string, unknown>,
  schema: Record<string, unknown>
): string | null {
  if (schema.type !== 'object') return null;

  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  for (const key of required) {
    if (!(key in args) || args[key] === undefined) {
      return `Missing required argument: '${key}'.`;
    }
  }

  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (properties) {
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!(key in args)) continue;
      const val = args[key];
      const expectedType = propSchema.type as string | undefined;
      if (!expectedType) continue;

      let typeError: string | null = null;
      if (expectedType === 'array') {
        if (!Array.isArray(val)) {
          typeError = `Argument '${key}' must be of type array, got ${val === null ? 'null' : typeof val}.`;
        }
      } else if (expectedType === 'object') {
        if (val === null || typeof val !== 'object' || Array.isArray(val)) {
          typeError = `Argument '${key}' must be of type object, got ${Array.isArray(val) ? 'array' : val === null ? 'null' : typeof val}.`;
        }
      } else if (expectedType === 'integer') {
        if (typeof val !== 'number' || !Number.isInteger(val)) {
          typeError = `Argument '${key}' must be an integer, got ${typeof val}.`;
        }
      } else {
        // string, number, boolean
        const actualType = typeof val;
        if (actualType !== expectedType) {
          typeError = `Argument '${key}' must be of type ${expectedType}, got ${actualType}.`;
        }
      }

      if (typeError) return typeError;
    }
  }

  return null;
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
