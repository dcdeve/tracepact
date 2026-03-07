import type { ToolCall, ToolCallSource, ToolResult, ToolTrace } from './types.js';

export class TraceBuilder {
  private calls: ToolCall[] = [];
  private index = 0;

  /**
   * Add a tool call to the trace.
   *
   * Shorthand: `addCall(toolName, args, resultContent)` — creates a success result with durationMs=0.
   * Full form: `addCall({ toolName, args, result, durationMs, ... })`
   */
  addCall(
    paramsOrName:
      | {
          toolName: string;
          args: Record<string, unknown>;
          result: ToolResult;
          durationMs: number;
          unknownTool?: boolean;
          source?: ToolCallSource;
        }
      | string,
    args?: Record<string, unknown>,
    resultContent?: string
  ): this {
    let call: ToolCall;

    if (typeof paramsOrName === 'string') {
      call = {
        toolName: paramsOrName,
        args: args ?? {},
        result: { type: 'success', content: resultContent ?? '' },
        durationMs: 0,
        sequenceIndex: this.index++,
        unknownTool: false,
      };
    } else {
      call = {
        toolName: paramsOrName.toolName,
        args: paramsOrName.args,
        result: paramsOrName.result,
        durationMs: paramsOrName.durationMs,
        sequenceIndex: this.index++,
        unknownTool: paramsOrName.unknownTool ?? false,
        ...(paramsOrName.source ? { source: paramsOrName.source } : {}),
      };
    }

    this.calls.push(call);
    return this;
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
