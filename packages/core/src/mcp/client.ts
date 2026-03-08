import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolCallSource, ToolResult } from '../trace/types.js';

export interface McpClientConfig {
  /** Display name for this server (used in trace source tags) */
  server: string;
  /** Command to spawn the MCP server process */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables for the server process */
  env?: Record<string, string>;
}

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export class McpClient {
  readonly server: string;
  readonly source: ToolCallSource;
  private client: Client;
  private transport: StdioClientTransport;
  private _tools: McpToolInfo[] = [];
  private _connected = false;

  constructor(private config: McpClientConfig) {
    this.server = config.server;
    this.source = { type: 'mcp', server: config.server };
    const transportParams: { command: string; args?: string[]; env?: Record<string, string> } = {
      command: config.command,
    };
    if (config.args) transportParams.args = config.args;
    if (config.env) transportParams.env = config.env;
    this.transport = new StdioClientTransport(transportParams);
    this.client = new Client({
      name: 'tracepact',
      version: '0.4.0',
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
    this._connected = true;

    const response = await this.client.listTools();
    this._tools = (response.tools ?? []).map((t) => {
      const info: McpToolInfo = {
        name: t.name,
        inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
      };
      if (t.description) info.description = t.description;
      return info;
    });
  }

  get tools(): readonly McpToolInfo[] {
    return this._tools;
  }

  get connected(): boolean {
    return this._connected;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this._connected) {
      throw new Error(`McpClient[${this.server}]: not connected. Call connect() first.`);
    }

    const response = await this.client.callTool({ name, arguments: args });

    if (response.isError) {
      const message = Array.isArray(response.content)
        ? response.content
            .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
            .map((c) => c.text)
            .join('\n')
        : String(response.content ?? 'MCP tool error');
      return { type: 'error', message };
    }

    const content = Array.isArray(response.content)
      ? response.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map((c) => c.text)
          .join('\n')
      : String(response.content ?? '');

    return { type: 'success', content };
  }

  async close(): Promise<void> {
    if (this._connected) {
      await this.transport.close();
      this._connected = false;
    }
  }
}
