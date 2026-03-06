export type ToolDefs = Record<string, import('zod').ZodTypeAny>;

export interface TypedToolDefinition<TName extends string = string, TSchema = unknown> {
  name: TName;
  schema: TSchema;
  jsonSchema: Record<string, unknown>;
}
