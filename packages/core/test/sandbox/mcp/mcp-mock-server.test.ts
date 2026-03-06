import { describe, expect, it } from 'vitest';
import { createMcpMock } from '../../../src/sandbox/mcp/index.js';

describe('McpMockServer', () => {
  it('executes a known tool and returns result', async () => {
    const mock = createMcpMock({
      server: 'test-server',
      tools: {
        greet: (args) => ({ type: 'success', content: `Hello ${args.name}` }),
      },
    });

    const result = await mock.executeTool('greet', { name: 'World' });
    expect(result).toEqual({ type: 'success', content: 'Hello World' });
  });

  it('returns error for unknown tool', async () => {
    const mock = createMcpMock({
      server: 'db-server',
      tools: {},
    });

    const result = await mock.executeTool('missing_tool', {});
    expect(result.type).toBe('error');
    expect(result.message).toContain('missing_tool');
  });

  it('supports async handlers', async () => {
    const mock = createMcpMock({
      server: 'async-server',
      tools: {
        fetch_data: async (args) => {
          await new Promise((r) => setTimeout(r, 5));
          return { type: 'success', content: `data for ${args.id}` };
        },
      },
    });

    const result = await mock.executeTool('fetch_data', { id: '42' });
    expect(result).toEqual({ type: 'success', content: 'data for 42' });
  });

  it('trace includes MCP source for all calls', async () => {
    const mock = createMcpMock({
      server: 'my-mcp',
      tools: {
        tool_a: () => ({ type: 'success', content: 'a' }),
        tool_b: () => ({ type: 'success', content: 'b' }),
      },
    });

    await mock.executeTool('tool_a', { x: 1 });
    await mock.executeTool('tool_b', {});
    await mock.executeTool('unknown', {});

    const trace = mock.getTrace();
    expect(trace.totalCalls).toBe(3);

    for (const call of trace.calls) {
      expect(call.source).toEqual({ type: 'mcp', server: 'my-mcp' });
    }

    expect(trace.calls[0]?.toolName).toBe('tool_a');
    expect(trace.calls[1]?.toolName).toBe('tool_b');
    expect(trace.calls[2]?.unknownTool).toBe(true);
  });

  it('reset clears the trace', async () => {
    const mock = createMcpMock({
      server: 's',
      tools: { t: () => ({ type: 'success', content: '' }) },
    });

    await mock.executeTool('t', {});
    expect(mock.getTrace().totalCalls).toBe(1);

    mock.reset();
    expect(mock.getTrace().totalCalls).toBe(0);
  });
});
