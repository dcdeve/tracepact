import type { MockToolImpl } from '../sandbox/types.js';
import type { TypedToolDefinition } from '../tools/types.js';
import type { ToolCallSource } from '../trace/types.js';
import { McpClient, type McpClientConfig } from './client.js';

export interface McpConnection {
  /** Server name (matches trace source tags) */
  server: string;
  /** Tool definitions for the LLM driver */
  tools: TypedToolDefinition[];
  /** Tool handlers for MockSandbox */
  handlers: Record<string, MockToolImpl>;
  /** Source tags for MockSandbox trace attribution */
  sources: Record<string, ToolCallSource>;
  /** Close the MCP server connection */
  close: () => Promise<void>;
}

/**
 * Connect to a real MCP server process and return handlers compatible with MockSandbox.
 *
 * ```ts
 * const fs = await connectMcp({
 *   server: 'filesystem',
 *   command: 'npx',
 *   args: ['@modelcontextprotocol/server-filesystem', '/tmp/project'],
 * });
 *
 * const sandbox = new MockSandbox(fs.handlers, fs.sources);
 * ```
 */
export async function connectMcp(config: McpClientConfig): Promise<McpConnection> {
  const client = new McpClient(config);
  await client.connect();

  const handlers: Record<string, MockToolImpl> = {};
  const sources: Record<string, ToolCallSource> = {};
  const tools: TypedToolDefinition[] = [];

  for (const tool of client.tools) {
    handlers[tool.name] = (args) => client.callTool(tool.name, args);
    sources[tool.name] = client.source;
    tools.push({
      name: tool.name,
      schema: tool.inputSchema,
      jsonSchema: tool.inputSchema,
    });
  }

  return {
    server: config.server,
    tools,
    handlers,
    sources,
    close: () => client.close(),
  };
}
