import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  type CassetteStub,
  type McpConnection,
  MockSandbox,
  type MockToolDefs,
  type ParsedSkill,
  type RunConfig,
  type RunResult,
  TokenAccumulator,
  type ToolCallSource,
  type TracepactConfig,
  type TypedToolDefinition,
  executePrompt,
} from '@tracepact/core';
import { trackUsage } from './token-tracker.js';

/** MCP connections registered during the current test, to be closed in afterEach. */
const _pendingMcpConnections: McpConnection[] = [];

/** @internal Called by setup.ts afterEach to drain and close all registered connections. */
export async function _closePendingMcpConnections(): Promise<void> {
  const conns = _pendingMcpConnections.splice(0);
  await Promise.all(conns.map((c) => c.close()));
}

export interface RunSkillOptions {
  prompt: string;
  sandbox?: MockSandbox;
  tools?: TypedToolDefinition[];
  /** MCP server connections (from connectMcp) — tools are auto-registered */
  mcp?: McpConnection[];
  config?: RunConfig;
  /** Override the provider config instead of reading from env */
  tracepactConfig?: Partial<TracepactConfig>;
  /** Path to save a cassette recording (requires live mode) */
  record?: string;
  /** Path to a cassette file to replay instead of running live */
  replay?: string;
  /** Stubs to apply when replaying a cassette */
  stubs?: CassetteStub[];
  /**
   * Execution mode override.
   * - `'mock'`: return an empty result from the sandbox without calling the LLM.
   *   Must be set explicitly; runSkill() will throw if no mode is configured.
   */
  mode?: 'mock';
}

function buildMcpSandbox(
  mcp: McpConnection[],
  extraTools?: TypedToolDefinition[]
): { sandbox: MockSandbox; tools: TypedToolDefinition[] } {
  const handlers: MockToolDefs = {};
  const sources: Record<string, ToolCallSource> = {};
  const tools: TypedToolDefinition[] = extraTools ? [...extraTools] : [];

  for (const conn of mcp) {
    Object.assign(handlers, conn.handlers);
    Object.assign(sources, conn.sources);
    tools.push(...conn.tools);
  }

  return { sandbox: new MockSandbox(handlers, sources), tools };
}

export async function runSkill(
  skill: ParsedSkill | string | { systemPrompt: string },
  input: RunSkillOptions
): Promise<RunResult> {
  const isLive = process.env.TRACEPACT_LIVE === '1';

  // Per-run accumulator: scopes budget enforcement to this single runSkill() call
  // so that token usage from previous tests does not trigger false budget errors.
  const runTokens = new TokenAccumulator();

  // Build sandbox from MCP connections (if provided and no explicit sandbox)
  let sandbox = input.sandbox;
  let tools = input.tools;
  if (input.mcp?.length && !sandbox) {
    const merged = buildMcpSandbox(input.mcp, tools);
    sandbox = merged.sandbox;
    tools = merged.tools;
    // Register connections so setup.ts afterEach can close them
    _pendingMcpConnections.push(...input.mcp);
  }

  // Resolve replay path from env if not explicitly provided
  const replayDir = input.replay ?? process.env.TRACEPACT_REPLAY;
  const replay = replayDir ?? undefined;

  // Resolve record path: explicit > env var > none
  const shouldRecord = input.record ?? process.env.TRACEPACT_RECORD === '1';
  const recordPath =
    typeof input.record === 'string'
      ? input.record
      : shouldRecord
        ? generateCassettePath(input.prompt, tools)
        : undefined;

  // Replay mode or live mode: delegate to executePrompt
  if (replay || isLive) {
    const execOpts: Parameters<typeof executePrompt>[1] = { prompt: input.prompt };
    if (sandbox) execOpts.sandbox = sandbox;
    if (tools) execOpts.tools = tools;
    if (input.config) execOpts.config = input.config;
    if (input.tracepactConfig) execOpts.tracepactConfig = input.tracepactConfig;
    if (recordPath) execOpts.record = recordPath;
    if (replay) execOpts.replay = replay;
    if (input.stubs) execOpts.stubs = input.stubs;

    const result = await executePrompt(skill, execOpts);

    // Track token usage (vitest-specific concern)
    if (isLive && result.usage.inputTokens > 0) {
      trackUsage(
        process.env.TRACEPACT_PROVIDER ?? 'unknown',
        result.usage.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
        runTokens
      );
    }

    return result;
  }

  // Mock-only mode: must be explicitly opted into via `mode: 'mock'`
  if (input.mode !== 'mock') {
    throw new Error(
      '[tracepact] runSkill() has no execution mode configured. ' +
        'Set TRACEPACT_LIVE=1 for live execution, ' +
        'pass replay: "path/to/cassette.json" for replay, ' +
        'or pass mode: "mock" to explicitly return an empty mock result.'
    );
  }
  const fallbackSandbox = sandbox ?? new MockSandbox({});

  // Compute real content hashes even in mock mode so the runManifest is unique per input.
  const mockSkillHash =
    typeof skill === 'string'
      ? createHash('sha256').update(skill).digest('hex')
      : 'hash' in skill
        ? skill.hash
        : createHash('sha256').update(skill.systemPrompt).digest('hex');
  const mockPromptHash = createHash('sha256').update(input.prompt).digest('hex');
  const mockToolDefsHash = createHash('sha256')
    .update(JSON.stringify((tools ?? []).map((t) => ({ name: t.name, schema: t.jsonSchema }))))
    .digest('hex');

  return {
    output: '',
    trace: fallbackSandbox.getTrace(),
    messages: [],
    usage: { inputTokens: 0, outputTokens: 0, model: 'mock' },
    duration: 0,
    runManifest: {
      skillHash: mockSkillHash,
      promptHash: mockPromptHash,
      toolDefsHash: mockToolDefsHash,
      provider: 'mock',
      model: 'mock',
      temperature: 0,
      frameworkVersion: 'mock',
      driverVersion: 'mock',
    },
    cacheStatus: 'skipped',
  };
}

/**
 * Generate a deterministic cassette file path from the prompt and tool names.
 * Including tool names prevents collisions when two tests share the same prompt
 * but differ in their tool definitions.
 * Produces: ./cassettes/<slug>-<hash>.json
 */
function generateCassettePath(prompt: string, tools?: TypedToolDefinition[]): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const toolNames =
    tools
      ?.map((t) => t.name)
      .sort()
      .join(',') ?? '';
  const hash = createHash('sha256')
    .update(prompt)
    .update('\0')
    .update(toolNames)
    .digest('hex')
    .slice(0, 8);
  const dir = process.env.TRACEPACT_CASSETTE_DIR ?? 'cassettes';
  return join(dir, `${slug}-${hash}.json`);
}
