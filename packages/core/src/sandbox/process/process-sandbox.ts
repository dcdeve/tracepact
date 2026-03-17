import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { log } from '../../logger.js';
import { TraceBuilder } from '../../trace/trace-builder.js';
import type { ToolResult, ToolTrace } from '../../trace/types.js';
import { isAllowedCommand, isAllowedPath } from '../glob-utils.js';
import type { Sandbox } from '../types.js';
import type { ProcessSandboxConfig } from './types.js';

const exec = promisify(execFile);

export class ProcessSandbox implements Sandbox {
  private config: ProcessSandboxConfig;
  private workdir: string;
  private ownsWorkdir: boolean;
  private traceBuilder = new TraceBuilder();
  private writes: Array<{ path: string; content: string }> = [];

  constructor(config: ProcessSandboxConfig = {}) {
    this.config = config;
    if (config.workdir) {
      this.workdir = resolve(config.workdir);
      this.ownsWorkdir = false;
    } else {
      this.workdir = mkdtempSync(join(tmpdir(), 'tracepact-sandbox-'));
      this.ownsWorkdir = true;
    }
    log.info(`ProcessSandbox workdir: ${this.workdir}`);
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const start = performance.now();
    const timeout = this.config.timeout ?? 30_000;
    let result: ToolResult;

    if (name === 'read_file') {
      result = this.handleReadFile(String(args.path ?? ''));
    } else if (name === 'write_file') {
      result = this.handleWriteFile(String(args.path ?? ''), String(args.content ?? ''));
    } else if (name === 'bash') {
      result = await this.handleBash(String(args.command ?? ''), timeout);
    } else {
      result = {
        type: 'error',
        message: `Unknown tool: '${name}'. ProcessSandbox supports: read_file, write_file, bash.`,
      };
    }

    const durationMs = performance.now() - start;
    this.traceBuilder.addCall({
      toolName: name,
      args,
      result,
      durationMs,
      unknownTool: result.type === 'error' && result.message.startsWith('Unknown tool:'),
      source: { type: 'local' },
    });
    return result;
  }

  private handleReadFile(path: string): ToolResult {
    if (!this.isAllowedPath(path)) {
      return { type: 'error', message: `Path "${path}" is not in the filesystem allowlist.` };
    }
    try {
      const resolved = this.resolvePath(path);
      const content = readFileSync(resolved, 'utf-8');
      return { type: 'success', content };
    } catch (err: any) {
      return { type: 'error', message: err.message };
    }
  }

  private handleWriteFile(path: string, content: string): ToolResult {
    if (!this.isAllowedPath(path)) {
      return { type: 'error', message: `Path "${path}" is not in the filesystem allowlist.` };
    }
    try {
      const resolved = this.resolvePath(path);
      mkdirSync(dirname(resolved), { recursive: true });
      writeFileSync(resolved, content, 'utf-8');
      this.writes.push({ path, content });
      return { type: 'success', content: '' };
    } catch (err: any) {
      return { type: 'error', message: err.message };
    }
  }

  private async handleBash(command: string, timeout: number): Promise<ToolResult> {
    if (!this.isAllowedCommand(command)) {
      return { type: 'error', message: `Command "${command}" is not in the bash allowlist.` };
    }
    try {
      const { stdout, stderr } = await exec('sh', ['-c', command], {
        cwd: this.workdir,
        timeout,
        env: this.getSafeEnv(),
        maxBuffer: 10 * 1024 * 1024,
      });
      if (stderr) log.info(`ProcessSandbox stderr: ${stderr.slice(0, 200)}`);
      return { type: 'success', content: stdout };
    } catch (err: any) {
      return {
        type: 'error',
        message: `Exit code ${err.code ?? 1}: ${err.stderr || err.message}`,
      };
    }
  }

  private resolvePath(path: string): string {
    const resolved = resolve(this.workdir, path);
    // Prevent path traversal outside workdir
    if (!resolved.startsWith(this.workdir)) {
      throw new Error(`Path traversal detected: "${path}" resolves outside sandbox workdir.`);
    }
    return resolved;
  }

  private getSafeEnv(): Record<string, string> {
    if (this.config.env) return this.config.env;
    return {
      PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
      HOME: this.workdir,
      TMPDIR: this.workdir,
      NODE_ENV: 'test',
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

  destroy(): void {
    if (this.ownsWorkdir) {
      try {
        rmSync(this.workdir, { recursive: true, force: true });
        log.info(`ProcessSandbox workdir cleaned: ${this.workdir}`);
      } catch (err: any) {
        log.warn(`Failed to clean ProcessSandbox workdir: ${err.message}`);
      }
    }
    this.traceBuilder.reset();
    this.writes.length = 0;
  }
}
