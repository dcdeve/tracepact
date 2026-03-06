import type { ToolCall, ToolTrace } from '../../trace/types.js';
import { matchArgs } from '../arg-matcher.js';
import type { MatcherResult } from '../types.js';

function mcpCalls(trace: ToolTrace, server: string): ToolCall[] {
  return trace.calls.filter((c) => c.source?.type === 'mcp' && c.source.server === server);
}

export function toHaveCalledMcpTool(
  trace: ToolTrace,
  serverName: string,
  toolName: string,
  expectedArgs?: Record<string, unknown>
): MatcherResult {
  const serverCalls = mcpCalls(trace, serverName);
  const matching = serverCalls.filter((c) => c.toolName === toolName);

  if (matching.length === 0) {
    const allMcpTools = [...new Set(serverCalls.map((c) => c.toolName))];
    return {
      pass: false,
      message: `Expected MCP server "${serverName}" to have called tool "${toolName}", but it was never called.`,
      tier: 0,
      diagnostic: {
        expected: { server: serverName, tool: toolName, args: expectedArgs },
        received: { callsTo: toolName, count: 0 },
        suggestion:
          allMcpTools.length > 0
            ? `Server "${serverName}" called: [${allMcpTools.join(', ')}]`
            : `No calls to MCP server "${serverName}" found in trace.`,
        tokens: 0,
      },
    };
  }

  if (expectedArgs) {
    const anyMatch = matching.some((c) => matchArgs(c.args, expectedArgs).matches);
    if (!anyMatch) {
      const firstCall = matching[0] as ToolCall;
      const { mismatches } = matchArgs(firstCall.args, expectedArgs);
      return {
        pass: false,
        message: `MCP "${serverName}:${toolName}" was called ${matching.length} time(s) but no call matched the expected args.`,
        tier: 0,
        diagnostic: {
          expected: expectedArgs,
          received: firstCall.args,
          relevantTrace: matching,
          suggestion: mismatches
            .map((m) => m.error ?? `Field "${m.field}": expected ${m.expected}, got ${m.received}`)
            .join('. '),
          tokens: 0,
        },
      };
    }
  }

  return {
    pass: true,
    message: `MCP "${serverName}:${toolName}" was called.`,
    tier: 0,
    diagnostic: { expected: toolName, received: toolName, tokens: 0 },
  };
}

export function toHaveCalledMcpServer(trace: ToolTrace, serverName: string): MatcherResult {
  const serverCalls = mcpCalls(trace, serverName);

  if (serverCalls.length === 0) {
    const allServers = [
      ...new Set(
        trace.calls
          .filter((c) => c.source?.type === 'mcp')
          .map((c) => (c.source as { type: 'mcp'; server: string }).server)
      ),
    ];
    return {
      pass: false,
      message: `Expected MCP server "${serverName}" to be called, but it was never called.`,
      tier: 0,
      diagnostic: {
        expected: { server: serverName },
        received: { servers: allServers },
        suggestion:
          allServers.length > 0
            ? `MCP servers called: [${allServers.join(', ')}]`
            : 'No MCP calls in trace.',
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `MCP server "${serverName}" was called ${serverCalls.length} time(s).`,
    tier: 0,
    diagnostic: { expected: serverName, received: serverName, tokens: 0 },
  };
}

export function toNotHaveCalledMcpTool(
  trace: ToolTrace,
  serverName: string,
  toolName: string
): MatcherResult {
  const matching = mcpCalls(trace, serverName).filter((c) => c.toolName === toolName);

  if (matching.length > 0) {
    return {
      pass: false,
      message: `Expected MCP "${serverName}:${toolName}" to not be called, but it was called ${matching.length} time(s).`,
      tier: 0,
      diagnostic: {
        expected: { server: serverName, tool: toolName, count: 0 },
        received: { count: matching.length },
        relevantTrace: matching,
        tokens: 0,
      },
    };
  }

  return {
    pass: true,
    message: `MCP "${serverName}:${toolName}" was not called.`,
    tier: 0,
    diagnostic: { expected: 0, received: 0, tokens: 0 },
  };
}

export interface McpCallSpec {
  server: string;
  tool: string;
}

export function toHaveCalledMcpToolsInOrder(trace: ToolTrace, calls: McpCallSpec[]): MatcherResult {
  const mcpOnly = trace.calls.filter((c) => c.source?.type === 'mcp');
  let searchFrom = 0;

  for (const spec of calls) {
    const idx = mcpOnly.findIndex(
      (c, i) =>
        i >= searchFrom &&
        c.source?.type === 'mcp' &&
        (c.source as { server: string }).server === spec.server &&
        c.toolName === spec.tool
    );

    if (idx === -1) {
      const actualSequence = mcpOnly.map(
        (c) => `${(c.source as { server: string }).server}:${c.toolName}`
      );
      return {
        pass: false,
        message: `Expected MCP calls in order but "${spec.server}:${spec.tool}" was not found after position ${searchFrom}.`,
        tier: 0,
        diagnostic: {
          expected: calls.map((s) => `${s.server}:${s.tool}`),
          received: actualSequence,
          suggestion: `Actual MCP sequence: [${actualSequence.join(' → ')}]`,
          tokens: 0,
        },
      };
    }
    searchFrom = idx + 1;
  }

  return {
    pass: true,
    message: `MCP tools called in order: [${calls.map((s) => `${s.server}:${s.tool}`).join(', ')}].`,
    tier: 0,
    diagnostic: {
      expected: calls.map((s) => `${s.server}:${s.tool}`),
      received: calls.map((s) => `${s.server}:${s.tool}`),
      tokens: 0,
    },
  };
}
