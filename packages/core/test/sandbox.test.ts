import { describe, expect, it } from 'vitest';
import {
  captureWrites,
  createMockTools,
  denyAll,
  mockBash,
  mockReadFile,
  passthrough,
} from '../src/sandbox/factories.js';
import { ProcessSandbox } from '../src/sandbox/process/process-sandbox.js';

describe('MockSandbox', () => {
  it('mockReadFile returns content for exact match', async () => {
    const sandbox = createMockTools({
      read_file: mockReadFile({ 'a.ts': 'code' }),
    });
    const result = await sandbox.executeTool('read_file', { path: 'a.ts' });
    expect(result).toEqual({ type: 'success', content: 'code' });
  });

  it('mockReadFile returns error for miss', async () => {
    const sandbox = createMockTools({
      read_file: mockReadFile({ 'a.ts': 'code' }),
    });
    const result = await sandbox.executeTool('read_file', { path: 'b.ts' });
    expect(result.type).toBe('error');
    expect((result as any).message).toContain('File not found: b.ts');
  });

  it('mockReadFile matches glob patterns', async () => {
    const sandbox = createMockTools({
      read_file: mockReadFile({ 'src/**/*.ts': 'stub' }),
    });
    const result = await sandbox.executeTool('read_file', { path: 'src/deep/file.ts' });
    expect(result).toEqual({ type: 'success', content: 'stub' });
  });

  it('mockReadFile **/*.ext matches files in root', async () => {
    const sandbox = createMockTools({
      read_file: mockReadFile({ '**/*.txt': 'found' }),
    });
    const root = await sandbox.executeTool('read_file', { path: 'readme.txt' });
    expect(root).toEqual({ type: 'success', content: 'found' });
    const nested = await sandbox.executeTool('read_file', { path: 'docs/guide.txt' });
    expect(nested).toEqual({ type: 'success', content: 'found' });
  });

  it('mockReadFile prefers exact match over glob', async () => {
    const sandbox = createMockTools({
      read_file: mockReadFile({ 'src/main.ts': 'exact', 'src/**/*.ts': 'glob' }),
    });
    const result = await sandbox.executeTool('read_file', { path: 'src/main.ts' });
    expect(result).toEqual({ type: 'success', content: 'exact' });
  });

  it('captureWrites records written files', async () => {
    const sandbox = createMockTools({
      write_file: captureWrites(),
    });
    await sandbox.executeTool('write_file', { path: 'out.ts', content: 'hello' });
    const writes = sandbox.getWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual({ path: 'out.ts', content: 'hello' });
  });

  it('denyAll returns error for any tool call', async () => {
    const sandbox = createMockTools({
      bash: denyAll(),
    });
    const result = await sandbox.executeTool('bash', { command: 'ls' });
    expect(result.type).toBe('error');
    expect((result as any).message).toContain('denied');
  });

  it('mockBash matches exact command', async () => {
    const sandbox = createMockTools({
      bash: mockBash({ 'npm test': { stdout: 'ok' } }),
    });
    const result = await sandbox.executeTool('bash', { command: 'npm test' });
    expect(result).toEqual({ type: 'success', content: 'ok' });
  });

  it('mockBash returns error for non-zero exit code', async () => {
    const sandbox = createMockTools({
      bash: mockBash({ 'bad cmd': { exitCode: 1, stderr: 'fail' } }),
    });
    const result = await sandbox.executeTool('bash', { command: 'bad cmd' });
    expect(result.type).toBe('error');
    expect((result as any).message).toContain('Exit code 1');
  });

  it('mockBash returns error for unmatched command', async () => {
    const sandbox = createMockTools({
      bash: mockBash({}),
    });
    const result = await sandbox.executeTool('bash', { command: 'unknown' });
    expect(result.type).toBe('error');
    expect((result as any).message).toContain('No mock defined');
  });

  it('passthrough returns success with empty content', async () => {
    const sandbox = createMockTools({
      any_tool: passthrough(),
    });
    const result = await sandbox.executeTool('any_tool', {});
    expect(result).toEqual({ type: 'success', content: '' });
  });

  it('returns error and marks unknownTool for undefined tools', async () => {
    const sandbox = createMockTools({});
    const result = await sandbox.executeTool('not_defined', {});
    expect(result.type).toBe('error');
    expect((result as any).message).toContain("Unknown tool: 'not_defined'");

    const trace = sandbox.getTrace();
    expect(trace.calls[0]?.unknownTool).toBe(true);
  });

  it('builds trace with correct sequence indices', async () => {
    const sandbox = createMockTools({
      a: passthrough(),
      b: passthrough(),
      c: passthrough(),
    });
    await sandbox.executeTool('a', {});
    await sandbox.executeTool('b', {});
    await sandbox.executeTool('c', {});

    const trace = sandbox.getTrace();
    expect(trace.totalCalls).toBe(3);
    expect(trace.calls[0]?.sequenceIndex).toBe(0);
    expect(trace.calls[1]?.sequenceIndex).toBe(1);
    expect(trace.calls[2]?.sequenceIndex).toBe(2);
  });

  it('resets trace and writes', async () => {
    const sandbox = createMockTools({
      write_file: captureWrites(),
      a: passthrough(),
    });
    await sandbox.executeTool('a', {});
    await sandbox.executeTool('write_file', { path: 'x', content: 'y' });
    sandbox.reset();

    expect(sandbox.getTrace().totalCalls).toBe(0);
    expect(sandbox.getWrites()).toHaveLength(0);
  });

  it('handles async mock implementations', async () => {
    const sandbox = createMockTools({
      slow_tool: async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { type: 'success', content: 'done' };
      },
    });
    const result = await sandbox.executeTool('slow_tool', {});
    expect(result).toEqual({ type: 'success', content: 'done' });
    expect(sandbox.getTrace().totalCalls).toBe(1);
  });
});

describe('ProcessSandbox.isAllowedPath', () => {
  it('**/*.ext matches files in root and nested dirs', () => {
    const sandbox = new ProcessSandbox({ allow: { fs: ['**/*.txt'] } });
    expect(sandbox.isAllowedPath('readme.txt')).toBe(true);
    expect(sandbox.isAllowedPath('docs/guide.txt')).toBe(true);
    expect(sandbox.isAllowedPath('a/b/c.txt')).toBe(true);
    expect(sandbox.isAllowedPath('readme.md')).toBe(false);
  });

  it('single * does not cross directories', () => {
    const sandbox = new ProcessSandbox({ allow: { fs: ['*.ts'] } });
    expect(sandbox.isAllowedPath('index.ts')).toBe(true);
    expect(sandbox.isAllowedPath('src/index.ts')).toBe(false);
  });

  it('allows all paths when no fs allowlist', () => {
    const sandbox = new ProcessSandbox({});
    expect(sandbox.isAllowedPath('anything')).toBe(true);
  });
});
