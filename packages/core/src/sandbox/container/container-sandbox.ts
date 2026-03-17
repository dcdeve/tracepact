import { resolve } from 'node:path';
import { TraceBuilder } from '../../trace/trace-builder.js';
import type { ToolResult, ToolTrace } from '../../trace/types.js';
import { isAllowedCommand, isAllowedPath } from '../glob-utils.js';
import type { McpMockServer } from '../mcp/mcp-mock-server.js';
import type { Sandbox } from '../types.js';
import { DockerClient } from './docker-client.js';
import type { ContainerConfig } from './types.js';

export class ContainerSandbox implements Sandbox {
  private config: ContainerConfig;
  private docker: DockerClient;
  private containerId: string | null = null;
  private traceBuilder = new TraceBuilder();
  private writes: Array<{ path: string; content: string }> = [];
  private mcpServers: Record<string, McpMockServer>;

  constructor(
    config: ContainerConfig,
    docker?: DockerClient,
    mcpServers?: Record<string, McpMockServer>
  ) {
    this.config = config;
    this.docker = docker ?? new DockerClient();
    this.mcpServers = mcpServers ?? {};
  }

  async initialize(): Promise<void> {
    const mounts = Object.entries(this.config.mount ?? {}).map(([host, container]) => ({
      host: resolve(host),
      container,
    }));

    this.containerId = await this.docker.createContainer({
      image: this.config.image,
      mounts,
      network: this.config.network === 'allow' ? 'bridge' : 'none',
      limits: {
        ...(this.config.limits?.cpu ? { cpu: this.config.limits.cpu } : {}),
        ...(this.config.limits?.memory ? { memory: this.config.limits.memory } : {}),
      },
    });
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const id = this.containerId;
    if (!id) {
      throw new Error('Container not initialized. Call initialize() first.');
    }

    const start = performance.now();
    const timeout = this.config.limits?.timeout ?? 30_000;
    let result: ToolResult;

    // Check for MCP-routed tools: mcp__<server>__<tool>
    const mcpMatch = name.match(/^mcp__([^_]+(?:__[^_]+)*)__([^_].*)$/);
    if (mcpMatch) {
      const serverName = mcpMatch[1] as string;
      const toolName = mcpMatch[2] as string;
      const server = this.mcpServers[serverName];
      if (server) {
        result = await server.executeTool(toolName, args);
        const durationMs = performance.now() - start;
        this.traceBuilder.addCall({
          toolName: name,
          args,
          result,
          durationMs,
          unknownTool: false,
          source: { type: 'mcp', server: serverName },
        });
        return result;
      }
      result = {
        type: 'error',
        message: `No MCP server "${serverName}" configured.`,
      };
      const durationMs = performance.now() - start;
      this.traceBuilder.addCall({ toolName: name, args, result, durationMs, unknownTool: true });
      return result;
    }

    if (name === 'read_file') {
      result = await this.handleReadFile(id, String(args.path ?? ''));
    } else if (name === 'write_file') {
      result = await this.handleWriteFile(id, String(args.path ?? ''), String(args.content ?? ''));
    } else if (name === 'bash') {
      result = await this.handleBash(id, String(args.command ?? ''), timeout);
    } else {
      result = {
        type: 'error',
        message: `Unknown tool: '${name}'. Container sandbox supports: read_file, write_file, bash.`,
      };
    }

    const durationMs = performance.now() - start;
    this.traceBuilder.addCall({
      toolName: name,
      args,
      result,
      durationMs,
      unknownTool: false,
      source: { type: 'local' },
    });
    return result;
  }

  private async handleReadFile(id: string, path: string): Promise<ToolResult> {
    if (!this.isAllowedPath(path)) {
      return { type: 'error', message: `Path "${path}" is not in the filesystem allowlist.` };
    }
    try {
      const content = await this.docker.readFile(id, path);
      return { type: 'success', content };
    } catch (err: any) {
      return { type: 'error', message: err.message };
    }
  }

  private async handleWriteFile(id: string, path: string, content: string): Promise<ToolResult> {
    if (!this.isAllowedPath(path)) {
      return { type: 'error', message: `Path "${path}" is not in the filesystem allowlist.` };
    }
    try {
      await this.docker.writeFile(id, path, content);
      this.writes.push({ path, content });
      return { type: 'success', content: '' };
    } catch (err: any) {
      return { type: 'error', message: err.message };
    }
  }

  private async handleBash(id: string, command: string, timeout: number): Promise<ToolResult> {
    if (!this.isAllowedCommand(command)) {
      return { type: 'error', message: `Command "${command}" is not in the bash allowlist.` };
    }
    const result = await this.docker.execInContainer(id, ['sh', '-c', command], timeout);
    if (result.exitCode === 0) {
      return { type: 'success', content: result.stdout };
    }
    return {
      type: 'error',
      message: `Exit code ${result.exitCode}: ${result.stderr || result.stdout}`,
    };
  }

  isAllowedPath(path: string): boolean {
    return isAllowedPath(path, this.config.allow?.fs);
  }

  isAllowedCommand(command: string): boolean {
    return isAllowedCommand(command, this.config.allow?.bash);
  }

  getTrace(): ToolTrace {
    return this.traceBuilder.build();
  }

  getWrites(): ReadonlyArray<{ path: string; content: string }> {
    return this.writes;
  }

  async destroy(): Promise<void> {
    if (this.containerId) {
      await this.docker.destroyContainer(this.containerId);
      this.containerId = null;
    }
    this.traceBuilder.reset();
    this.writes.length = 0;
  }
}
