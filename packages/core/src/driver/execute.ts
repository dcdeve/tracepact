import { createHash } from 'node:crypto';
import pkg from '../../package.json' assert { type: 'json' };
import { CacheStore } from '../cache/cache-store.js';
import { CassettePlayer } from '../cassette/player.js';
import { CassetteRecorder } from '../cassette/recorder.js';
import type { CassetteStub } from '../cassette/types.js';
import type { TracepactConfig } from '../config/types.js';
import { log } from '../logger.js';
import { parseSkill } from '../parser/skill-parser.js';
import type { ParsedSkill } from '../parser/types.js';
import { RedactionPipeline } from '../redaction/pipeline.js';
import { MockSandbox } from '../sandbox/mock-sandbox.js';
import type { Sandbox } from '../sandbox/types.js';
import type { TypedToolDefinition } from '../tools/types.js';
import { DriverRegistry, _setRegistryCacheChecker } from './registry.js';
import { detectProvider, resolveConfig } from './resolve.js';
import type { RunConfig, RunResult } from './types.js';

// Module-level cache: reuse registries across executePrompt() calls when config is stable
// (i.e. no per-call providers override that would produce a different TracepactConfig).
const _registryCache = new Map<string, DriverRegistry>();

// Wire up the stale-cache checker so registry.ts can warn if register() is called late.
_setRegistryCacheChecker(() => _registryCache.size > 0);

/** Clear the module-level registry cache. Call this in test teardown (e.g. afterAll) to
 * prevent stale registries from leaking across test suites that change env vars. */
export function clearRegistryCache(): void {
  _registryCache.clear();
}

export interface ExecutePromptOptions {
  prompt: string;
  sandbox?: Sandbox;
  tools?: TypedToolDefinition[];
  config?: RunConfig;
  tracepactConfig?: Partial<TracepactConfig>;
  /** Path to save a cassette recording */
  record?: string;
  /** Path to a cassette file to replay */
  replay?: string;
  /** Stubs to apply when replaying a cassette */
  stubs?: CassetteStub[];
  /**
   * When true (default), replay throws if the current prompt differs from the recorded one.
   * Set to false to allow replaying cassettes recorded with a different prompt (opt-out).
   */
  replayStrict?: boolean;
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
    const player = new CassettePlayer(opts.replay, opts.stubs, opts.replayStrict ?? true);
    const replayToolDefsHash =
      opts.tools !== undefined
        ? createHash('sha256')
            .update(
              stableStringify(
                [...opts.tools]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((t) => ({ name: t.name, schema: t.jsonSchema }))
              )
            )
            .digest('hex')
        : undefined;
    return player.replay(opts.prompt, replayToolDefsHash);
  }

  // 4. Execute via driver
  const providerName = opts.provider ?? detectProvider();
  const config = resolveConfig(providerName, opts.tracepactConfig);
  const hasProviderOverrides = !!opts.tracepactConfig?.providers || !!opts.tracepactConfig?.model;
  const cacheKey = hasProviderOverrides
    ? null
    : `${providerName}::${process.env.TRACEPACT_MODEL ?? ''}`;
  let registry = cacheKey !== null ? _registryCache.get(cacheKey) : undefined;
  if (!registry) {
    registry = new DriverRegistry(config);
    registry.validateAll();
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
  const cache = new CacheStore(cacheConfig, config.redaction);

  const cachedEntry = await cache.get(
    // We need a manifest to look up the cache. Build a minimal one from what we know pre-run.
    // The driver fills in modelVersion/seed post-run, but provider+model+skill+prompt are stable.
    {
      skillHash: computeSkillHash(resolvedSkill),
      promptHash: createHash('sha256').update(opts.prompt).digest('hex'),
      toolDefsHash: createHash('sha256')
        .update(
          stableStringify(
            [...(opts.tools ?? [])]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => ({ name: t.name, schema: t.jsonSchema }))
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
      frameworkVersion: pkg.version,
      driverVersion: pkg.version,
    }
  );

  if (cachedEntry) {
    return { ...(cachedEntry.result as RunResult), cacheStatus: 'hit' };
  }

  const result = await driver.run(runInput);
  // driver.run() must always produce a manifest for live runs.
  const manifest = result.runManifest;
  if (!manifest) {
    throw new Error(
      `Driver "${providerName}" returned no runManifest for a live run. All drivers must populate runManifest when executing against a real LLM.`
    );
  }

  // 4b. Populate cache with the actual manifest produced by the driver.
  await cache.set(manifest, result);
  let cacheStatus: RunResult['cacheStatus'];
  if (!cacheConfig.enabled) {
    cacheStatus = 'skipped';
  } else if (cache.writeFailures > 0) {
    cacheStatus = 'failed';
    log.warn(
      `Cache: ${cache.writeFailures} write failure(s) during this run. ` +
        `All cache entries were lost. Check that "${config.cache.dir}" is writable.`
    );
  } else {
    cacheStatus = 'miss';
  }
  const resultWithCacheStatus: RunResult = { ...result, cacheStatus };

  // 5. Record cassette if requested
  if (opts.record) {
    const skillHash = computeSkillHash(resolvedSkill);
    const recorder = new CassetteRecorder(opts.record, config.redaction);
    await recorder.save(result, {
      source: 'skill_run',
      skillHash,
      prompt: opts.prompt,
      promptHash: manifest.promptHash,
      toolDefsHash: manifest.toolDefsHash,
      provider: providerName,
      model: result.usage.model,
      temperature: manifest.temperature,
      frameworkVersion: manifest.frameworkVersion,
      driverVersion: manifest.driverVersion,
    });
  }

  // 6. Redact the result before returning to the caller so that secrets never
  //    leak through console.log, telemetry export, or other caller-side handling.
  const redaction = new RedactionPipeline(config.redaction);
  return redaction.redactObject(resultWithCacheStatus);
}

/** JSON.stringify with sorted keys at every level — produces a stable output regardless of insertion order. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${sorted.join(',')}}`;
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
