import type { ToolDefs, TypedToolDefinition } from './types.js';

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
    try {
      jsonSchema = zodToJsonSchema(schema);
    } catch {
      jsonSchema = { type: 'object' };
    }
    return { name, schema, jsonSchema };
  });
}

function zodToJsonSchema(schema: any): Record<string, unknown> {
  const def = schema?._def;
  if (!def) return { type: 'object' };

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = def.shape();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, val] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(val as any);
        if ((val as any)?._def?.typeName !== 'ZodOptional') {
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
    default:
      return { type: 'object' };
  }
}
