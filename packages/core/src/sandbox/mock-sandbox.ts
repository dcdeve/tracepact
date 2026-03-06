import { log } from '../logger.js';
import { TraceBuilder } from '../trace/trace-builder.js';
import type { ToolResult, ToolTrace } from '../trace/types.js';
import type { MockToolDefs, WriteCapture } from './types.js';

export class MockSandbox {
  private readonly tools: MockToolDefs;
  private readonly traceBuilder = new TraceBuilder();
  private readonly writes: WriteCapture[] = [];

  constructor(tools: MockToolDefs) {
    this.tools = tools;
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const start = performance.now();
    const impl = this.tools[name];
    let result: ToolResult;
    let unknownTool = false;

    if (!impl) {
      unknownTool = true;
      result = { type: 'error', message: `Unknown tool: '${name}'.` };
      log.warn(`MockSandbox: agent called unknown tool '${name}'.`);
    } else {
      try {
        result = await impl(args);
      } catch (err: any) {
        result = { type: 'error', message: `Mock threw: ${err.message}` };
      }
    }

    const durationMs = performance.now() - start;
    this.traceBuilder.addCall({ toolName: name, args, result, durationMs, unknownTool });

    if (name === 'write_file' && result.type === 'success' && typeof args.path === 'string') {
      this.writes.push({ path: args.path, content: String(args.content ?? '') });
    }

    return result;
  }

  getTrace(): ToolTrace {
    return this.traceBuilder.build();
  }

  getWrites(): readonly WriteCapture[] {
    return this.writes;
  }

  reset(): void {
    this.traceBuilder.reset();
    this.writes.length = 0;
  }
}
