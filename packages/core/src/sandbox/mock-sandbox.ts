import { log } from '../logger.js';
import { TraceBuilder } from '../trace/trace-builder.js';
import type { ToolCallSource, ToolResult, ToolTrace } from '../trace/types.js';
import type { MockToolDefs, WriteCapture } from './types.js';

export class MockSandbox {
  private readonly tools: MockToolDefs;
  private readonly sources: Record<string, ToolCallSource>;
  private readonly traceBuilder = new TraceBuilder();
  private readonly writes: WriteCapture[] = [];
  private readonly writeToolName: string;

  constructor(
    tools: MockToolDefs,
    sources?: Record<string, ToolCallSource>,
    writeToolName = 'write_file'
  ) {
    this.tools = tools;
    this.sources = sources ?? {};
    this.writeToolName = writeToolName;
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
        log.error(`MockSandbox: tool '${name}' threw an error.`, err);
        result = { type: 'error', message: `Mock threw: ${err.message}` };
      }
    }

    const durationMs = performance.now() - start;
    const source = this.sources[name];
    if (source) {
      this.traceBuilder.addCall({ toolName: name, args, result, durationMs, unknownTool, source });
    } else {
      this.traceBuilder.addCall({ toolName: name, args, result, durationMs, unknownTool });
    }

    if (name === this.writeToolName && result.type === 'success' && typeof args.path === 'string') {
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
