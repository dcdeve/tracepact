import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { handleAudit } from './tools/audit.js';
import { handleCapture } from './tools/capture.js';
import { handleDiff } from './tools/diff.js';
import { handleListTests } from './tools/list-tests.js';
import { handleReplay } from './tools/replay.js';
import { handleRun } from './tools/run.js';
import {
  auditSchema,
  captureSchema,
  diffSchema,
  listTestsSchema,
  replaySchema,
  runSchema,
} from './tools/schemas.js';

const server = new McpServer(
  {
    name: 'tracepact',
    version: '0.3.0',
  },
  {
    capabilities: {
      tools: {},
    },
    instructions:
      'TracePact — behavioral testing framework for AI agents with tool use. ' +
      'Start with tracepact_audit to assess risk (free, instant). ' +
      'Use tracepact_list_tests to check existing coverage. ' +
      'Use tracepact_capture to auto-generate tests from cassettes. ' +
      'Use tracepact_run to execute the test suite. ' +
      'Use tracepact_diff to compare cassettes after changes.',
  }
);

// --- Tool registrations ---

server.registerTool(
  'tracepact_audit',
  {
    title: 'Audit Agent Skill',
    description:
      'Static analysis of a SKILL.md file — no API key needed, runs instantly. ' +
      'Checks for dangerous tool combinations (bash+network = exfiltration risk), ' +
      'missing prompt constraints, incomplete frontmatter, and vague tool names. ' +
      'Returns risk level (none/low/medium/high/critical) and actionable findings. ' +
      'Always run this first before other tools.',
    inputSchema: auditSchema,
  },
  async (args) => {
    const result = await handleAudit(args);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'tracepact_capture',
  {
    title: 'Capture & Generate Tests',
    description:
      'Generate a test file from a recorded cassette. ' +
      'Analyzes the agent trace to infer assertions automatically: ' +
      'which tools were called, argument patterns, output structure. ' +
      'Requires a cassette to exist — record one first with `tracepact run --record`.',
    inputSchema: captureSchema,
  },
  async (args) => {
    const result = await handleCapture(args);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'tracepact_run',
  {
    title: 'Run Test Suite',
    description:
      'Execute TracePact tests via Vitest. ' +
      'By default runs in mock mode (offline, free, deterministic). ' +
      'Use live=true for real API calls. ' +
      'Returns pass/fail status with detailed output.',
    inputSchema: runSchema,
  },
  async (args) => {
    const result = handleRun(args);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'tracepact_diff',
  {
    title: 'Compare Cassettes',
    description:
      'Compare two cassette recordings to detect behavioral drift. ' +
      'Shows added tool calls, removed tool calls, and argument changes. ' +
      'Use after modifying a prompt to verify the agent still behaves correctly.',
    inputSchema: diffSchema,
  },
  async (args) => {
    const result = await handleDiff(args);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'tracepact_list_tests',
  {
    title: 'List Tests & Cassettes',
    description:
      'Find test files (.test.ts, .tracepact.ts) and cassette recordings (.json) ' +
      'associated with a skill. Scans the skill directory recursively. ' +
      'Use to understand existing coverage before generating new tests.',
    inputSchema: listTestsSchema,
  },
  async (args) => {
    const result = handleListTests(args);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'tracepact_replay',
  {
    title: 'Replay Cassette',
    description:
      'Replay a recorded cassette without calling any API. ' +
      'Returns the full trace for inspection. ' +
      'Use to verify cassette integrity or examine past agent behavior.',
    inputSchema: replaySchema,
  },
  async (args) => {
    const result = handleReplay(args);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Start server ---

const transport = new StdioServerTransport();
await server.connect(transport);
