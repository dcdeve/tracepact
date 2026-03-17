import type {
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3ToolResultOutput,
} from '@ai-sdk/provider';
import { TraceBuilder } from '@tracepact/core';
import type { ToolResult, ToolTrace } from '@tracepact/core';

interface PendingCall {
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
}

export class Tracker {
  private readonly traceBuilder = new TraceBuilder();
  private readonly pendingCalls = new Map<string, PendingCall>();
  private output = '';
  private inputTokens = 0;
  private outputTokens = 0;

  /**
   * Call before each doGenerate. Scans the prompt for tool results
   * that resolve pending tool calls from previous turns.
   */
  beforeGenerate(options: LanguageModelV3CallOptions): void {
    const now = Date.now();
    for (const msg of options.prompt) {
      if (msg.role !== 'tool') continue;
      for (const part of msg.content) {
        if (part.type !== 'tool-result') continue;
        const pending = this.pendingCalls.get(part.toolCallId);
        if (!pending) continue;

        this.traceBuilder.addCall({
          toolName: pending.toolName,
          args: pending.args,
          result: mapToolResultOutput(part.output),
          durationMs: now - pending.timestamp,
          unknownTool: false,
          source: { type: 'local' },
        });
        this.pendingCalls.delete(part.toolCallId);
      }
    }
  }

  /**
   * Call after each doGenerate. Extracts tool calls and text from the response.
   */
  afterGenerate(result: LanguageModelV3GenerateResult): void {
    const now = Date.now();
    for (const part of result.content) {
      if (part.type === 'tool-call') {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(part.input) as Record<string, unknown>;
        } catch {
          args = {};
        }
        this.pendingCalls.set(part.toolCallId, {
          toolName: part.toolName,
          args,
          timestamp: now,
        });
      }
    }

    // Accumulate usage
    this.inputTokens += result.usage.inputTokens.total ?? 0;
    this.outputTokens += result.usage.outputTokens.total ?? 0;

    // Capture text output from terminal responses
    if (result.finishReason.unified === 'stop') {
      this.output = result.content
        .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join('');
    }
  }

  getTrace(): ToolTrace {
    return this.traceBuilder.build();
  }

  getResult(): { trace: ToolTrace; output: string } {
    return { trace: this.getTrace(), output: this.output };
  }

  getUsage(): { inputTokens: number; outputTokens: number } {
    return { inputTokens: this.inputTokens, outputTokens: this.outputTokens };
  }
}

export function mapToolResultOutput(output: LanguageModelV3ToolResultOutput): ToolResult {
  switch (output.type) {
    case 'text':
      return { type: 'success', content: output.value };
    case 'json':
      return { type: 'success', content: JSON.stringify(output.value) };
    case 'content':
      return {
        type: 'success',
        content: output.value
          .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
          .map((p) => p.text)
          .join(''),
      };
    case 'error-text':
      return { type: 'error', message: output.value };
    case 'error-json':
      return { type: 'error', message: JSON.stringify(output.value) };
    case 'execution-denied':
      return { type: 'error', message: output.reason ?? 'execution denied' };
  }
}
