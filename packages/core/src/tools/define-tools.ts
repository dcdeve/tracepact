import type { JsonSchema, ToolDefs, TypedToolDefinition } from './types.js';

export function defineTools<T extends ToolDefs>(defs: T): TypedToolDefinition[] {
  const names = Object.keys(defs);
  for (const name of names) {
    if (name.trim() === '') {
      throw new Error('Tool name cannot be empty.');
    }
  }

  return names.map((name) => {
    const schema = defs[name];
    let jsonSchema: Record<string, unknown>;

    if (isJsonSchema(schema)) {
      jsonSchema = schema;
    } else {
      try {
        jsonSchema = zodToJsonSchema(schema);
      } catch (err) {
        console.warn(
          `[define-tools] Failed to convert schema for tool "${name}" to JSON Schema. Falling back to generic object schema. Error:`,
          err
        );
        jsonSchema = { type: 'object' };
      }
    }

    return { name, schema, jsonSchema };
  });
}

function isJsonSchema(val: unknown): val is JsonSchema {
  return (
    val !== null &&
    typeof val === 'object' &&
    'type' in val &&
    typeof (val as any).type === 'string' &&
    !('_def' in val)
  );
}

function zodToJsonSchema(schema: any): Record<string, unknown> {
  // Try zod v4's built-in toJSONSchema if available
  if (typeof schema.toJSONSchema === 'function') {
    try {
      return schema.toJSONSchema();
    } catch {
      // fall through to manual conversion
    }
  }

  const def = schema?._def;
  if (!def) return { type: 'object' };

  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodObject': {
      // shape can be a function (zod v3) or a plain object (zod v4)
      const rawShape = def.shape;
      const shape = typeof rawShape === 'function' ? rawShape() : rawShape;
      if (!shape || typeof shape !== 'object') return { type: 'object' };

      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, val] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(val as any);
        if (!isOptional(val)) {
          required.push(key);
        }
      }
      return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
    }
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray':
      return { type: 'array', items: zodToJsonSchema(def.type) };
    case 'ZodEnum':
      return { type: 'string', enum: def.values };
    case 'ZodOptional':
      return zodToJsonSchema(def.innerType);
    case 'ZodDefault':
      return zodToJsonSchema(def.innerType);
    case 'ZodNullable': {
      const inner = zodToJsonSchema(def.innerType);
      return { ...inner, nullable: true };
    }
    default:
      return { type: 'object' };
  }
}

function isOptional(val: any): boolean {
  const typeName = val?._def?.typeName;
  if (typeName === 'ZodOptional') return true;
  if (typeName === 'ZodDefault') return true;
  return false;
}
