export interface ToolTrace {
  readonly calls: readonly ToolCall[];
  readonly totalCalls: number;
  readonly totalDurationMs: number;
}

export type ToolCallSource =
  | { readonly type: 'local' }
  | { readonly type: 'mcp'; readonly server: string; readonly uri?: string };

export interface ToolCall {
  readonly toolName: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly result: ToolResult;
  readonly durationMs: number;
  readonly sequenceIndex: number;
  readonly unknownTool: boolean;
  readonly source?: ToolCallSource;
}

export type ToolResult =
  | { readonly type: 'success'; readonly content: string }
  | { readonly type: 'error'; readonly message: string };
