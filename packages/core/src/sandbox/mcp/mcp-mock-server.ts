import { log } from '../../logger.js';
import { TraceBuilder } from '../../trace/trace-builder.js';
import type { ToolCallSource, ToolResult, ToolTrace } from '../../trace/types.js';

export type McpToolHandler = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;

export interface McpMockConfig {
  server: string;
  tools: Record<string, McpToolHandler>;
}

export class McpMockServer {
  readonly server: string;
  private tools: Record<string, McpToolHandler>;
  private traceBuilder = new TraceBuilder();

  constructor(config: McpMockConfig) {
    this.server = config.server;
    this.tools = config.tools;
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const start = performance.now();
    const source: ToolCallSource = { type: 'mcp', server: this.server };
    const handler = this.tools[toolName];
    let result: ToolResult;

    if (!handler) {
      result = {
        type: 'error',
        message: `MCP server "${this.server}" has no tool "${toolName}".`,
      };
      log.warn(`McpMockServer[${this.server}]: unknown tool "${toolName}"`);
    } else {
      try {
        result = await handler(args);
      } catch (err: any) {
        result = { type: 'error', message: `MCP handler threw: ${err.message}` };
      }
    }

    const durationMs = performance.now() - start;
    this.traceBuilder.addCall({
      toolName,
      args,
      result,
      durationMs,
      unknownTool: !handler,
      source,
    });

    return result;
  }

  getTrace(): ToolTrace {
    return this.traceBuilder.build();
  }

  reset(): void {
    this.traceBuilder.reset();
  }
}

export function createMcpMock(config: McpMockConfig): McpMockServer {
  return new McpMockServer(config);
}
