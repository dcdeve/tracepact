/**
 * @modelcontextprotocol/server-filesystem — Integration Test
 *
 * Tests connectMcp() against the REAL filesystem MCP server.
 * No LLM needed — this validates tool discovery and execution
 * by calling MCP tools directly through the TracePact adapter.
 *
 * Run: npx vitest run --config examples/filesystem/vitest.config.ts
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockSandbox, connectMcp } from '@tracepact/vitest';
import type { McpConnection } from '@tracepact/vitest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const TEST_DIR = join(tmpdir(), `tracepact-fs-test-${Date.now()}`);

describe('filesystem MCP: integration with real server', () => {
  let fs: McpConnection;

  beforeAll(async () => {
    // Create test directory with sample files
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'README.md'), '# Test Project\n\nHello world.');
    writeFileSync(join(TEST_DIR, 'src', 'app.ts'), 'export const name = "test";');
    writeFileSync(join(TEST_DIR, 'src', 'utils.ts'), '// TODO: implement helpers');

    // Connect to real filesystem MCP server
    fs = await connectMcp({
      server: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', TEST_DIR],
    });
  }, 30_000);

  afterAll(async () => {
    await fs?.close();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test('discovers tools from the MCP server', () => {
    const toolNames = fs.tools.map((t) => t.name);
    expect(toolNames).toContain('read_text_file');
    expect(toolNames).toContain('write_file');
    expect(toolNames).toContain('list_directory');
    expect(toolNames).toContain('search_files');
    expect(toolNames).toContain('edit_file');
  });

  test('generates handlers for MockSandbox', () => {
    expect(typeof fs.handlers.read_text_file).toBe('function');
    expect(typeof fs.handlers.write_file).toBe('function');
    expect(typeof fs.handlers.list_directory).toBe('function');
  });

  test('generates source tags for trace attribution', () => {
    expect(fs.sources.read_text_file).toEqual({ type: 'mcp', server: 'filesystem' });
    expect(fs.sources.write_file).toEqual({ type: 'mcp', server: 'filesystem' });
  });

  test('reads a file through MockSandbox with MCP source', async () => {
    const sandbox = new MockSandbox(fs.handlers, fs.sources);
    const result = await sandbox.executeTool('read_text_file', {
      path: join(TEST_DIR, 'README.md'),
    });

    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.content).toContain('# Test Project');
    }

    const trace = sandbox.getTrace();
    expect(trace.totalCalls).toBe(1);
    expect(trace.calls[0]?.source).toEqual({ type: 'mcp', server: 'filesystem' });
    expect(trace.calls[0]?.toolName).toBe('read_text_file');
  });

  test('lists directory through MockSandbox', async () => {
    const sandbox = new MockSandbox(fs.handlers, fs.sources);
    const result = await sandbox.executeTool('list_directory', {
      path: TEST_DIR,
    });

    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.content).toContain('README.md');
      expect(result.content).toContain('src');
    }
  });

  test('search_files executes without error', async () => {
    const sandbox = new MockSandbox(fs.handlers, fs.sources);
    const result = await sandbox.executeTool('search_files', {
      path: TEST_DIR,
      pattern: 'TODO',
    });

    // search_files returns success even if no matches found
    expect(result.type).toBe('success');

    const trace = sandbox.getTrace();
    expect(trace.calls[0]?.source).toEqual({ type: 'mcp', server: 'filesystem' });
  });

  test('writes and reads back a file', async () => {
    const sandbox = new MockSandbox(fs.handlers, fs.sources);

    const writeResult = await sandbox.executeTool('write_file', {
      path: join(TEST_DIR, 'output.txt'),
      content: 'Written by TracePact test',
    });
    expect(writeResult.type).toBe('success');

    const readResult = await sandbox.executeTool('read_text_file', {
      path: join(TEST_DIR, 'output.txt'),
    });
    expect(readResult.type).toBe('success');
    if (readResult.type === 'success') {
      expect(readResult.content).toContain('Written by TracePact test');
    }

    // Trace shows both operations with MCP source
    const trace = sandbox.getTrace();
    expect(trace.totalCalls).toBe(2);
    expect(trace.calls.every((c) => c.source?.type === 'mcp')).toBe(true);
  });

  test('rejects path traversal (server enforces boundaries)', async () => {
    const sandbox = new MockSandbox(fs.handlers, fs.sources);
    const result = await sandbox.executeTool('read_text_file', {
      path: '/etc/passwd',
    });

    // The MCP server should deny this
    expect(result.type).toBe('error');
  });

  test('MCP matchers work on traces from real MCP calls', async () => {
    const sandbox = new MockSandbox(fs.handlers, fs.sources);
    await sandbox.executeTool('list_directory', { path: TEST_DIR });
    await sandbox.executeTool('read_text_file', {
      path: join(TEST_DIR, 'src', 'app.ts'),
    });

    const trace = sandbox.getTrace();

    // These are the same matchers you'd use in a real agent test
    expect(trace).toHaveCalledMcpServer('filesystem');
    expect(trace).toHaveCalledMcpTool('filesystem', 'list_directory');
    expect(trace).toHaveCalledMcpTool('filesystem', 'read_text_file');
    expect(trace).toHaveCalledMcpToolsInOrder([
      { server: 'filesystem', tool: 'list_directory' },
      { server: 'filesystem', tool: 'read_text_file' },
    ]);
    expect(trace).toNotHaveCalledMcpTool('filesystem', 'write_file');
  });
});
