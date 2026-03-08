import { TraceBuilder } from '@tracepact/vitest';
/**
 * @modelcontextprotocol/server-filesystem — Happy Path
 *
 * Tests that an agent using the official filesystem MCP server follows
 * correct tool usage patterns: reads before writes, uses edit_file with
 * dryRun, and produces expected output.
 *
 * Tools: read_text_file, read_multiple_files, write_file, edit_file,
 *        list_directory, search_files, create_directory, move_file,
 *        get_file_info, list_allowed_directories
 */
import { describe, expect, test } from 'vitest';

const MCP = 'filesystem';

describe('filesystem MCP: happy path', () => {
  test('reads a file before modifying it', () => {
    const trace = new TraceBuilder()
      .addCall({
        toolName: 'read_text_file',
        args: { path: '/project/src/config.ts' },
        result: { type: 'success', content: 'export const port = 3000;' },
        durationMs: 5,
        source: { type: 'mcp', server: MCP },
      })
      .addCall({
        toolName: 'edit_file',
        args: {
          path: '/project/src/config.ts',
          edits: [{ oldText: 'port = 3000', newText: 'port = 8080' }],
          dryRun: false,
        },
        result: { type: 'success', content: 'File edited successfully' },
        durationMs: 3,
        source: { type: 'mcp', server: MCP },
      })
      .build();

    expect(trace).toHaveCalledMcpServer(MCP);
    expect(trace).toHaveCalledMcpToolsInOrder([
      { server: MCP, tool: 'read_text_file' },
      { server: MCP, tool: 'edit_file' },
    ]);
  });

  test('uses edit_file dryRun before applying changes', () => {
    const trace = new TraceBuilder()
      .addCall({
        toolName: 'read_text_file',
        args: { path: '/project/src/app.ts' },
        result: { type: 'success', content: 'const name = "old";' },
        durationMs: 3,
        source: { type: 'mcp', server: MCP },
      })
      .addCall({
        toolName: 'edit_file',
        args: {
          path: '/project/src/app.ts',
          edits: [{ oldText: '"old"', newText: '"new"' }],
          dryRun: true,
        },
        result: {
          type: 'success',
          content: '--- a/src/app.ts\n+++ b/src/app.ts\n-const name = "old";\n+const name = "new";',
        },
        durationMs: 2,
        source: { type: 'mcp', server: MCP },
      })
      .addCall({
        toolName: 'edit_file',
        args: {
          path: '/project/src/app.ts',
          edits: [{ oldText: '"old"', newText: '"new"' }],
          dryRun: false,
        },
        result: { type: 'success', content: 'File edited successfully' },
        durationMs: 3,
        source: { type: 'mcp', server: MCP },
      })
      .build();

    expect(trace).toHaveCalledMcpToolsInOrder([
      { server: MCP, tool: 'read_text_file' },
      { server: MCP, tool: 'edit_file' }, // dryRun
      { server: MCP, tool: 'edit_file' }, // apply
    ]);
  });

  test('lists directory with [FILE]/[DIR] prefixes before reading', () => {
    const trace = new TraceBuilder()
      .addCall({
        toolName: 'list_directory',
        args: { path: '/project/src' },
        result: {
          type: 'success',
          content: '[DIR] components\n[DIR] utils\n[FILE] index.ts\n[FILE] config.ts',
        },
        durationMs: 4,
        source: { type: 'mcp', server: MCP },
      })
      .addCall({
        toolName: 'read_text_file',
        args: { path: '/project/src/index.ts' },
        result: { type: 'success', content: 'import { port } from "./config";' },
        durationMs: 3,
        source: { type: 'mcp', server: MCP },
      })
      .build();

    expect(trace).toHaveCalledMcpToolsInOrder([
      { server: MCP, tool: 'list_directory' },
      { server: MCP, tool: 'read_text_file' },
    ]);
  });

  test('uses search_files to find files by content', () => {
    const trace = new TraceBuilder()
      .addCall({
        toolName: 'search_files',
        args: { path: '/project', pattern: 'TODO' },
        result: {
          type: 'success',
          content: '/project/src/handler.ts:12: // TODO: add validation',
        },
        durationMs: 15,
        source: { type: 'mcp', server: MCP },
      })
      .addCall({
        toolName: 'read_text_file',
        args: { path: '/project/src/handler.ts' },
        result: { type: 'success', content: '// handler code...' },
        durationMs: 3,
        source: { type: 'mcp', server: MCP },
      })
      .build();

    expect(trace).toHaveCalledMcpTool(MCP, 'search_files', { pattern: 'TODO' });
    expect(trace).toHaveCalledMcpToolsInOrder([
      { server: MCP, tool: 'search_files' },
      { server: MCP, tool: 'read_text_file' },
    ]);
  });

  test('reads multiple files in a single call', () => {
    const trace = new TraceBuilder()
      .addCall({
        toolName: 'read_multiple_files',
        args: { paths: ['/project/src/a.ts', '/project/src/b.ts'] },
        result: {
          type: 'success',
          content:
            '--- /project/src/a.ts ---\nexport const a = 1;\n--- /project/src/b.ts ---\nexport const b = 2;',
        },
        durationMs: 6,
        source: { type: 'mcp', server: MCP },
      })
      .build();

    expect(trace).toHaveCalledMcpTool(MCP, 'read_multiple_files');
  });
});
