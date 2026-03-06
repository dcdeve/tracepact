import { afterEach, describe, expect, it } from 'vitest';
import { ProcessSandbox } from '../../src/sandbox/process/process-sandbox.js';

describe('ProcessSandbox', () => {
  let sandbox: ProcessSandbox;

  afterEach(() => {
    sandbox?.destroy();
  });

  it('creates a temp workdir by default', () => {
    sandbox = new ProcessSandbox();
    const trace = sandbox.getTrace();
    expect(trace.totalCalls).toBe(0);
  });

  it('executes bash commands in the workdir', async () => {
    sandbox = new ProcessSandbox();
    const result = await sandbox.executeTool('bash', { command: 'echo hello' });
    expect(result.type).toBe('success');
    expect(result).toHaveProperty('content');
    if (result.type === 'success') {
      expect(result.content.trim()).toBe('hello');
    }
  });

  it('writes and reads files within workdir', async () => {
    sandbox = new ProcessSandbox();
    const writeResult = await sandbox.executeTool('write_file', {
      path: 'test.txt',
      content: 'hello world',
    });
    expect(writeResult.type).toBe('success');

    const readResult = await sandbox.executeTool('read_file', { path: 'test.txt' });
    expect(readResult.type).toBe('success');
    if (readResult.type === 'success') {
      expect(readResult.content).toBe('hello world');
    }
  });

  it('prevents path traversal outside workdir', async () => {
    sandbox = new ProcessSandbox();
    const result = await sandbox.executeTool('read_file', { path: '../../../etc/passwd' });
    expect(result.type).toBe('error');
  });

  it('tracks writes', async () => {
    sandbox = new ProcessSandbox();
    await sandbox.executeTool('write_file', { path: 'a.txt', content: 'aaa' });
    await sandbox.executeTool('write_file', { path: 'b.txt', content: 'bbb' });
    expect(sandbox.getWrites()).toHaveLength(2);
  });

  it('builds trace from tool executions', async () => {
    sandbox = new ProcessSandbox();
    await sandbox.executeTool('bash', { command: 'echo hi' });
    await sandbox.executeTool('write_file', { path: 'x.txt', content: '' });
    const trace = sandbox.getTrace();
    expect(trace.totalCalls).toBe(2);
    expect(trace.calls[0].toolName).toBe('bash');
    expect(trace.calls[1].toolName).toBe('write_file');
  });

  it('respects filesystem allowlist', async () => {
    sandbox = new ProcessSandbox({ allow: { fs: ['src/**'] } });
    const result = await sandbox.executeTool('read_file', { path: 'config/secret.json' });
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('allowlist');
    }
  });

  it('respects bash allowlist', async () => {
    sandbox = new ProcessSandbox({ allow: { bash: ['echo hello'] } });
    const denied = await sandbox.executeTool('bash', { command: 'rm -rf /' });
    expect(denied.type).toBe('error');

    const allowed = await sandbox.executeTool('bash', { command: 'echo hello' });
    expect(allowed.type).toBe('success');
  });

  it('returns error for unknown tools', async () => {
    sandbox = new ProcessSandbox();
    const result = await sandbox.executeTool('unknown_tool', {});
    expect(result.type).toBe('error');
  });

  it('uses clean env by default', async () => {
    sandbox = new ProcessSandbox();
    const result = await sandbox.executeTool('bash', { command: 'echo $NODE_ENV' });
    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.content.trim()).toBe('test');
    }
  });

  it('cleans up workdir on destroy', async () => {
    sandbox = new ProcessSandbox();
    await sandbox.executeTool('write_file', { path: 'temp.txt', content: 'temp' });
    sandbox.destroy();
    // After destroy, trace should be reset
    expect(sandbox.getTrace().totalCalls).toBe(0);
    expect(sandbox.getWrites()).toHaveLength(0);
  });
});
