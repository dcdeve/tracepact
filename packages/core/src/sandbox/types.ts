import type { ToolResult } from '../trace/types.js';

/** A function that simulates a tool's behavior */
export type MockToolImpl = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;

/** Map of tool name → mock implementation */
export type MockToolDefs = Record<string, MockToolImpl>;

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
