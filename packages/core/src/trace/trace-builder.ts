import type { ToolCall, ToolCallSource, ToolResult, ToolTrace } from './types.js';

export class TraceBuilder {
  private calls: ToolCall[] = [];
  private index = 0;

  addCall(params: {
    toolName: string;
    args: Record<string, unknown>;
    result: ToolResult;
    durationMs: number;
    unknownTool?: boolean;
    source?: ToolCallSource;
  }): void {
    const call: ToolCall = {
      toolName: params.toolName,
      args: params.args,
      result: params.result,
      durationMs: params.durationMs,
      sequenceIndex: this.index++,
      unknownTool: params.unknownTool ?? false,
      ...(params.source ? { source: params.source } : {}),
    };
    this.calls.push(call);
  }

  build(): ToolTrace {
    const totalDurationMs = this.calls.reduce((sum, c) => sum + c.durationMs, 0);
    return Object.freeze({
      calls: Object.freeze([...this.calls]),
      totalCalls: this.calls.length,
      totalDurationMs,
    });
  }

  reset(): void {
    this.calls = [];
    this.index = 0;
  }
}
