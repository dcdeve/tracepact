import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContainerSandbox } from '../../../src/sandbox/container/container-sandbox.js';
import type { DockerClient } from '../../../src/sandbox/container/docker-client.js';
import type { ContainerConfig } from '../../../src/sandbox/container/types.js';
import { createMcpMock } from '../../../src/sandbox/mcp/index.js';

function createMockDocker(): DockerClient {
  const files: Record<string, string> = {
    '/workspace/config.yaml': 'app: my-app',
  };

  return {
    getRuntime: () => 'docker' as const,
    createContainer: vi.fn().mockResolvedValue('mock-container-id-123'),
    destroyContainer: vi.fn().mockResolvedValue(undefined),
    isAvailable: vi.fn().mockResolvedValue(true),
    getVersion: vi.fn().mockResolvedValue('Docker version 24.0.7'),
    readFile: vi.fn().mockImplementation(async (_id: string, path: string) => {
      if (files[path]) return files[path];
      throw new Error(`No such file: ${path}`);
    }),
    writeFile: vi.fn().mockImplementation(async (_id: string, path: string, content: string) => {
      files[path] = content;
    }),
    execInContainer: vi
      .fn()
      .mockImplementation(async (_id: string, command: string[], _timeout: number) => {
        const cmd = command.join(' ');
        if (cmd.includes('npm test')) {
          return { stdout: '5 tests passed', stderr: '', exitCode: 0, durationMs: 100 };
        }
        if (cmd.includes('fail-cmd')) {
          return { stdout: '', stderr: 'command not found', exitCode: 127, durationMs: 10 };
        }
        return { stdout: 'ok', stderr: '', exitCode: 0, durationMs: 50 };
      }),
  } as unknown as DockerClient;
}

const baseConfig: ContainerConfig = {
  image: 'node:20-slim',
  mount: { './fixtures': '/workspace' },
  network: 'deny',
  limits: { cpu: '0.5', memory: '512m', timeout: 30000 },
};

describe('ContainerSandbox', () => {
  let sandbox: ContainerSandbox;
  let docker: DockerClient;

  beforeEach(async () => {
    docker = createMockDocker();
    sandbox = new ContainerSandbox(baseConfig, docker);
    await sandbox.initialize();
  });

  it('initializes container with correct config', () => {
    expect(docker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'node:20-slim',
        network: 'none',
        limits: { cpu: '0.5', memory: '512m' },
      })
    );
  });

  it('reads file successfully', async () => {
    const result = await sandbox.executeTool('read_file', { path: '/workspace/config.yaml' });
    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.content).toBe('app: my-app');
    }
  });

  it('writes file and captures write', async () => {
    const result = await sandbox.executeTool('write_file', {
      path: '/workspace/output.txt',
      content: 'hello',
    });
    expect(result.type).toBe('success');
    expect(sandbox.getWrites()).toHaveLength(1);
    expect(sandbox.getWrites()[0]).toEqual({ path: '/workspace/output.txt', content: 'hello' });
  });

  it('executes bash command', async () => {
    const result = await sandbox.executeTool('bash', { command: 'npm test' });
    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.content).toBe('5 tests passed');
    }
  });

  it('returns error for failed bash command', async () => {
    const result = await sandbox.executeTool('bash', { command: 'fail-cmd' });
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('127');
    }
  });

  it('returns error for unknown tool', async () => {
    const result = await sandbox.executeTool('search_web', { query: 'test' });
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('Unknown tool');
    }
  });

  it('builds trace from tool calls', async () => {
    await sandbox.executeTool('read_file', { path: '/workspace/config.yaml' });
    await sandbox.executeTool('bash', { command: 'npm test' });
    await sandbox.executeTool('write_file', { path: '/workspace/out.txt', content: 'done' });

    const trace = sandbox.getTrace();
    expect(trace.totalCalls).toBe(3);
    expect(trace.calls.map((c) => c.toolName)).toEqual(['read_file', 'bash', 'write_file']);
  });

  it('destroys container and resets state', async () => {
    await sandbox.executeTool('bash', { command: 'echo hi' });
    await sandbox.destroy();

    expect(docker.destroyContainer).toHaveBeenCalledWith('mock-container-id-123');
    expect(sandbox.getTrace().totalCalls).toBe(0);
    expect(sandbox.getWrites()).toHaveLength(0);
  });

  it('throws if executeTool called before initialize', async () => {
    const uninitSandbox = new ContainerSandbox(baseConfig, docker);
    await expect(uninitSandbox.executeTool('bash', { command: 'echo' })).rejects.toThrow(
      'Container not initialized'
    );
  });

  it('uses bridge network when allow', async () => {
    const allowNetDocker = createMockDocker();
    const s = new ContainerSandbox({ ...baseConfig, network: 'allow' }, allowNetDocker);
    await s.initialize();
    expect(allowNetDocker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'bridge' })
    );
    await s.destroy();
  });
});

describe('ContainerSandbox allowlists', () => {
  let docker: DockerClient;

  beforeEach(() => {
    docker = createMockDocker();
  });

  it('denies read outside fs allowlist', async () => {
    const sandbox = new ContainerSandbox(
      { ...baseConfig, allow: { fs: ['/workspace/**'] } },
      docker
    );
    await sandbox.initialize();

    const result = await sandbox.executeTool('read_file', { path: '/etc/passwd' });
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('not in the filesystem allowlist');
    }
    await sandbox.destroy();
  });

  it('allows read inside fs allowlist', async () => {
    const sandbox = new ContainerSandbox(
      { ...baseConfig, allow: { fs: ['/workspace/**'] } },
      docker
    );
    await sandbox.initialize();

    const result = await sandbox.executeTool('read_file', { path: '/workspace/config.yaml' });
    expect(result.type).toBe('success');
    await sandbox.destroy();
  });

  it('denies write outside fs allowlist', async () => {
    const sandbox = new ContainerSandbox(
      { ...baseConfig, allow: { fs: ['/workspace/**'] } },
      docker
    );
    await sandbox.initialize();

    const result = await sandbox.executeTool('write_file', {
      path: '/tmp/bad.txt',
      content: 'x',
    });
    expect(result.type).toBe('error');
    await sandbox.destroy();
  });

  it('denies bash command not in allowlist', async () => {
    const sandbox = new ContainerSandbox(
      { ...baseConfig, allow: { bash: [/^npm (test|build)$/] } },
      docker
    );
    await sandbox.initialize();

    const result = await sandbox.executeTool('bash', { command: 'rm -rf /' });
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('not in the bash allowlist');
    }
    await sandbox.destroy();
  });

  it('allows bash command matching regex', async () => {
    const sandbox = new ContainerSandbox(
      { ...baseConfig, allow: { bash: [/^npm (test|build)$/] } },
      docker
    );
    await sandbox.initialize();

    const result = await sandbox.executeTool('bash', { command: 'npm test' });
    expect(result.type).toBe('success');
    await sandbox.destroy();
  });

  it('allows bash command matching exact string', async () => {
    const sandbox = new ContainerSandbox(
      { ...baseConfig, allow: { bash: ['echo hello'] } },
      docker
    );
    await sandbox.initialize();

    const result = await sandbox.executeTool('bash', { command: 'echo hello' });
    expect(result.type).toBe('success');
    await sandbox.destroy();
  });

  it('allows everything when no allowlist set', async () => {
    const sandbox = new ContainerSandbox({ ...baseConfig }, docker);
    await sandbox.initialize();

    await sandbox.executeTool('read_file', { path: '/etc/anything' });
    const r2 = await sandbox.executeTool('bash', { command: 'any command' });
    // read_file may error from mock (file not found), but not from allowlist
    expect(r2.type).toBe('success');
    await sandbox.destroy();
  });
});

describe('ContainerSandbox + MCP integration', () => {
  it('routes mcp__<server>__<tool> calls to McpMockServer', async () => {
    const docker = createMockDocker();
    const dbMock = createMcpMock({
      server: 'database',
      tools: {
        query: (args) => ({ type: 'success', content: `rows for ${args.sql}` }),
      },
    });

    const sandbox = new ContainerSandbox(baseConfig, docker, { database: dbMock });
    await sandbox.initialize();

    const result = await sandbox.executeTool('mcp__database__query', { sql: 'SELECT 1' });
    expect(result).toEqual({ type: 'success', content: 'rows for SELECT 1' });

    const trace = sandbox.getTrace();
    expect(trace.totalCalls).toBe(1);
    expect(trace.calls[0]?.source).toEqual({ type: 'mcp', server: 'database' });
    expect(trace.calls[0]?.toolName).toBe('mcp__database__query');

    await sandbox.destroy();
  });

  it('mixed local + MCP calls in same trace', async () => {
    const docker = createMockDocker();
    const fsMock = createMcpMock({
      server: 'remote-fs',
      tools: {
        list: () => ({ type: 'success', content: 'file1.txt\nfile2.txt' }),
      },
    });

    const sandbox = new ContainerSandbox(baseConfig, docker, { 'remote-fs': fsMock });
    await sandbox.initialize();

    await sandbox.executeTool('read_file', { path: '/workspace/config.yaml' });
    await sandbox.executeTool('mcp__remote-fs__list', { dir: '/' });
    await sandbox.executeTool('bash', { command: 'echo hi' });

    const trace = sandbox.getTrace();
    expect(trace.totalCalls).toBe(3);

    // Local calls have local source
    expect(trace.calls[0]?.source).toEqual({ type: 'local' });
    expect(trace.calls[2]?.source).toEqual({ type: 'local' });

    // MCP call has mcp source
    expect(trace.calls[1]?.source).toEqual({ type: 'mcp', server: 'remote-fs' });

    await sandbox.destroy();
  });
});
