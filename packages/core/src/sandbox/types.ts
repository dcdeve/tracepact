import type { ToolResult, ToolTrace } from '../trace/types.js';

/** Shared interface implemented by all sandbox types (MockSandbox, ContainerSandbox, ProcessSandbox). */
export interface Sandbox {
  executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  getTrace(): ToolTrace;
  getWrites(): ReadonlyArray<WriteCapture>;
}

/** A function that simulates a tool's behavior */
export type MockToolImpl = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;

/**
 * A tool entry that pairs an implementation with a JSON Schema.
 * When MockSandbox is constructed with `strict: true`, args are validated
 * against the schema before the impl is called.
 */
export interface MockToolEntry {
  schema: Record<string, unknown>;
  impl: MockToolImpl;
}

/** Map of tool name → mock implementation or schema-paired entry */
export type MockToolDefs = Record<string, MockToolImpl | MockToolEntry>;

export interface WriteCapture {
  path: string;
  content: string;
}

export interface MockBashResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}
