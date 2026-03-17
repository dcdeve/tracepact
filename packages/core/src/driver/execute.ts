import { createHash } from 'node:crypto';
import { CacheStore } from '../cache/cache-store.js';
import { CassettePlayer } from '../cassette/player.js';
import { CassetteRecorder } from '../cassette/recorder.js';
import type { CassetteStub } from '../cassette/types.js';
import type { TracepactConfig } from '../config/types.js';
import { log } from '../logger.js';
import { parseSkill } from '../parser/skill-parser.js';
import type { ParsedSkill } from '../parser/types.js';
import { MockSandbox } from '../sandbox/mock-sandbox.js';
import type { TypedToolDefinition } from '../tools/types.js';
import { DriverRegistry } from './registry.js';
import { detectProvider, resolveConfig } from './resolve.js';
import type { RunConfig, RunResult } from './types.js';

// Module-level cache: reuse registries across executePrompt() calls when config is stable
// (i.e. no per-call providers override that would produce a different TracepactConfig).
const _registryCache = new Map<string, DriverRegistry>();

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
  /** Run a health check against the provider before executing. Logs result to stderr. */
  healthCheck?: boolean;
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
  const hasProviderOverrides = !!opts.tracepactConfig?.providers;
  const cacheKey = hasProviderOverrides ? null : providerName;
  let registry = cacheKey !== null ? _registryCache.get(cacheKey) : undefined;
  if (!registry) {
    registry = new DriverRegistry(config);
    if (cacheKey !== null) _registryCache.set(cacheKey, registry);
  }
  const driver = registry.get(providerName);

  // Optional health check before the first real call
  if (opts.healthCheck) {
    try {
      const health = await driver.healthCheck();
      if (health.ok) {
        console.error(
          `  \u2713 Provider "${providerName}": reachable (${Math.round(health.latencyMs)}ms, ${health.model})`
        );
      } else {
        console.error(`  \u2717 Provider "${providerName}": ${health.error}`);
      }
    } catch (err: any) {
      console.error(`  \u2717 Provider "${providerName}": ${err.message}`);
    }
  }

  const runInput: any = {
    skill: resolvedSkill,
    prompt: opts.prompt,
    sandbox,
  };
  if (opts.tools) runInput.tools = opts.tools;
  if (opts.config) runInput.config = opts.config;

  // 4a. Cache lookup (skip if --no-cache / TRACEPACT_NO_CACHE=1)
  const cacheDisabled = process.env.TRACEPACT_NO_CACHE === '1';
  const cacheConfig = { ...config.cache, enabled: config.cache.enabled && !cacheDisabled };
  const cache = new CacheStore(cacheConfig);

  const cachedEntry = await cache.get(
    // We need a manifest to look up the cache. Build a minimal one from what we know pre-run.
    // The driver fills in modelVersion/seed post-run, but provider+model+skill+prompt are stable.
    {
      skillHash: computeSkillHash(resolvedSkill),
      promptHash: createHash('sha256').update(opts.prompt).digest('hex'),
      toolDefsHash: createHash('sha256')
        .update(
          JSON.stringify(
            (opts.tools ?? []).map((t) => ({ name: t.name, schema: (t as any).jsonSchema }))
          )
        )
        .digest('hex'),
      provider: providerName,
      model: (() => {
        const pc = config.providers?.[providerName];
        return typeof pc === 'object' && pc !== null && 'model' in pc
          ? (pc as any).model
          : 'unknown';
      })(),
      temperature: opts.config?.temperature ?? 0,
      frameworkVersion: '__VERSION__',
      driverVersion: '__VERSION__',
    }
  );

  if (cachedEntry) {
    return cachedEntry.result as RunResult;
  }

  const result = await driver.run(runInput);

  // 4b. Populate cache with the actual manifest produced by the driver.
  await cache.set(result.runManifest, result);
  if (cache.writeFailures > 0) {
    log.warn(
      `Cache: ${cache.writeFailures} write failure(s) during this run. ` +
        `All cache entries were lost. Check that "${config.cache.dir}" is writable.`
    );
  }

  // 5. Record cassette if requested
  if (opts.record) {
    const skillHash = computeSkillHash(resolvedSkill);
    const recorder = new CassetteRecorder(opts.record, config.redaction);
    await recorder.save(result, {
      skillHash,
      prompt: opts.prompt,
      promptHash: result.runManifest.promptHash,
      toolDefsHash: result.runManifest.toolDefsHash,
      provider: providerName,
      model: result.usage.model,
      temperature: result.runManifest.temperature,
      frameworkVersion: result.runManifest.frameworkVersion,
      driverVersion: result.runManifest.driverVersion,
    });
  }

  return result;
}

function computeSkillHash(skill: ParsedSkill | { systemPrompt: string }): string {
  if ('hash' in skill && typeof skill.hash === 'string') return skill.hash;
  if ('systemPrompt' in skill) {
    return createHash('sha256').update(skill.systemPrompt).digest('hex');
  }
  throw new Error(
    'computeSkillHash: skill has neither a precomputed hash nor a systemPrompt — cannot derive a cache key'
  );
}
