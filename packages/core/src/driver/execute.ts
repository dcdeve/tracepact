import { createHash } from 'node:crypto';
import { CassettePlayer } from '../cassette/player.js';
import { CassetteRecorder } from '../cassette/recorder.js';
import type { CassetteStub } from '../cassette/types.js';
import type { TracepactConfig } from '../config/types.js';
import { parseSkill } from '../parser/skill-parser.js';
import type { ParsedSkill } from '../parser/types.js';
import { MockSandbox } from '../sandbox/mock-sandbox.js';
import type { TypedToolDefinition } from '../tools/types.js';
import { DriverRegistry } from './registry.js';
import { detectProvider, resolveConfig } from './resolve.js';
import type { RunConfig, RunResult } from './types.js';

export interface ExecutePromptOptions {
  prompt: string;
  sandbox?: MockSandbox;
  tools?: TypedToolDefinition[];
  config?: RunConfig;
  tracepactConfig?: Partial<TracepactConfig>;
  /** Path to save a cassette recording */
  record?: string;
  /** Path to a cassette file to replay */
  replay?: string;
  /** Stubs to apply when replaying a cassette */
  stubs?: CassetteStub[];
  /** Override provider detection */
  provider?: string;
}

/**
 * Execute a prompt against an LLM driver, optionally recording/replaying cassettes.
 * This is the shared orchestration used by both vitest's runSkill and the CLI capture command.
 */
export async function executePrompt(
  skill: ParsedSkill | string | { systemPrompt: string },
  opts: ExecutePromptOptions
): Promise<RunResult> {
  // 1. Resolve skill
  let resolvedSkill: ParsedSkill | { systemPrompt: string };
  if (typeof skill === 'string') {
    resolvedSkill = await parseSkill(skill);
  } else {
    resolvedSkill = skill;
  }

  // 2. Get sandbox (or create empty)
  const sandbox = opts.sandbox ?? new MockSandbox({});

  // 3. Replay mode
  if (opts.replay) {
    const player = new CassettePlayer(opts.replay, opts.stubs);
    return player.replay(opts.prompt);
  }

  // 4. Execute via driver
  const providerName = opts.provider ?? detectProvider();
  const config = resolveConfig(providerName, opts.tracepactConfig);
  const registry = new DriverRegistry(config);
  const driver = registry.get(providerName);

  const runInput: any = {
    skill: resolvedSkill,
    prompt: opts.prompt,
    sandbox,
  };
  if (opts.tools) runInput.tools = opts.tools;
  if (opts.config) runInput.config = opts.config;

  const result = await driver.run(runInput);

  // 5. Record cassette if requested
  if (opts.record) {
    const skillHash = computeSkillHash(resolvedSkill);
    const recorder = new CassetteRecorder(opts.record);
    await recorder.save(result, {
      skillHash,
      prompt: opts.prompt,
      provider: providerName,
      model: result.usage.model,
      frameworkVersion: '0.3.0',
    });
  }

  return result;
}

function computeSkillHash(skill: ParsedSkill | { systemPrompt: string }): string {
  if ('hash' in skill && typeof skill.hash === 'string') return skill.hash;
  if ('systemPrompt' in skill) {
    return createHash('sha256').update(skill.systemPrompt).digest('hex');
  }
  return 'unknown';
}
