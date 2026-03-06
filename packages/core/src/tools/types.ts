export type ToolDefs = Record<string, import('zod').ZodTypeAny | JsonSchema>;

export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface TypedToolDefinition<TName extends string = string, TSchema = unknown> {
  name: TName;
  schema: TSchema;
  jsonSchema: Record<string, unknown>;
}
