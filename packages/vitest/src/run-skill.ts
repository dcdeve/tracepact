import {
  type CassetteStub,
  MockSandbox,
  type ParsedSkill,
  type RunConfig,
  type RunResult,
  type TracepactConfig,
  type TypedToolDefinition,
  executePrompt,
} from '@tracepact/core';
import { trackUsage } from './token-tracker.js';

export interface RunSkillOptions {
  prompt: string;
  sandbox?: MockSandbox;
  tools?: TypedToolDefinition[];
  config?: RunConfig;
  /** Override the provider config instead of reading from env */
  tracepactConfig?: Partial<TracepactConfig>;
  /** Path to save a cassette recording (requires live mode) */
  record?: string;
  /** Path to a cassette file to replay instead of running live */
  replay?: string;
  /** Stubs to apply when replaying a cassette */
  stubs?: CassetteStub[];
}

export async function runSkill(
  skill: ParsedSkill | string | { systemPrompt: string },
  input: RunSkillOptions
): Promise<RunResult> {
  const isLive = process.env.TRACEPACT_LIVE === '1';

  // Replay mode or live mode: delegate to executePrompt
  if (input.replay || isLive) {
    const execOpts: Parameters<typeof executePrompt>[1] = { prompt: input.prompt };
    if (input.sandbox) execOpts.sandbox = input.sandbox;
    if (input.tools) execOpts.tools = input.tools;
    if (input.config) execOpts.config = input.config;
    if (input.tracepactConfig) execOpts.tracepactConfig = input.tracepactConfig;
    if (input.record) execOpts.record = input.record;
    if (input.replay) execOpts.replay = input.replay;
    if (input.stubs) execOpts.stubs = input.stubs;

    const result = await executePrompt(skill, execOpts);

    // Track token usage (vitest-specific concern)
    if (isLive && result.usage.inputTokens > 0) {
      trackUsage(
        process.env.TRACEPACT_PROVIDER ?? 'unknown',
        result.usage.model,
        result.usage.inputTokens,
        result.usage.outputTokens
      );
    }

    return result;
  }

  // Mock-only mode: return trace from sandbox
  console.warn(
    '[tracepact] runSkill() called without TRACEPACT_LIVE=1 or replay. ' +
      'Returning empty mock result. Set TRACEPACT_LIVE=1 for live execution, ' +
      'pass replay: "path/to/cassette.json" for replay, ' +
      'or use executePrompt() from @tracepact/core for direct live calls.'
  );
  const sandbox = input.sandbox ?? new MockSandbox({});
  return {
    output: '',
    trace: sandbox.getTrace(),
    messages: [],
    usage: { inputTokens: 0, outputTokens: 0, model: 'mock' },
    duration: 0,
    runManifest: undefined as any,
  };
}
