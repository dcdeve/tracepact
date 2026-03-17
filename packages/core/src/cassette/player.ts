import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { RunManifest } from '../cache/run-manifest.js';
import type { RunResult } from '../driver/types.js';
import { log } from '../logger.js';
import type { Cassette, CassetteStub } from './types.js';

function sha256Short(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

function firstDiffIndex(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return len;
}

/** Current cassette schema version written by CassetteRecorder. */
const CURRENT_VERSION = 2;

/**
 * Migrators indexed by the version they upgrade FROM.
 * Each migrator receives the cassette at version N and must return it at
 * version N+1. The `migrate` function below chains them automatically.
 */
const MIGRATORS: Record<number, (c: unknown) => unknown> = {
  1: (c: any) => ({
    ...c,
    version: 2,
    metadata: {
      ...c.metadata,
      source: 'skill_run',
    },
  }),
};

function migrate(raw: unknown): Cassette {
  let cassette = raw as any;
  const startVersion: number = cassette?.version;

  if (typeof startVersion !== 'number') {
    throw new Error('Cassette is missing a numeric "version" field.');
  }

  let version = startVersion;
  while (version < CURRENT_VERSION) {
    const migrator = MIGRATORS[version];
    if (!migrator) {
      throw new Error(
        `No migrator found for cassette version ${version} → ${version + 1}. Cannot load cassette recorded with version ${startVersion}.`
      );
    }
    cassette = migrator(cassette);
    version = (cassette as { version: number }).version;
  }

  if (version > CURRENT_VERSION) {
    throw new Error(
      `Cassette version ${version} is newer than this library supports (${CURRENT_VERSION}). Upgrade tracepact to load this cassette.`
    );
  }

  return cassette as Cassette;
}

export class CassettePlayer {
  private filePath: string;
  private stubs: CassetteStub[];
  private strict: boolean;
  private cachedCassette: Cassette | undefined;

  constructor(filePath: string, stubs?: CassetteStub[], strict = true) {
    this.filePath = filePath;
    this.stubs = stubs ?? [];
    this.strict = strict;
  }

  async load(): Promise<Cassette> {
    if (this.cachedCassette) {
      return this.cachedCassette;
    }
    const raw = await readFile(this.filePath, 'utf-8');
    this.cachedCassette = migrate(JSON.parse(raw));
    return this.cachedCassette;
  }

  /** Clears the cached cassette and reloads it from disk. */
  async reload(): Promise<Cassette> {
    this.cachedCassette = undefined;
    return this.load();
  }

  async replay(currentPrompt?: string, currentToolDefsHash?: string): Promise<RunResult> {
    const cassette = await this.load();

    // Validations only apply for skill_run cassettes
    if (cassette.metadata.source === 'skill_run') {
      if (currentPrompt && cassette.metadata.prompt !== currentPrompt) {
        const recordedHash = sha256Short(cassette.metadata.prompt);
        const currentHash = sha256Short(currentPrompt);
        const diffAt = firstDiffIndex(cassette.metadata.prompt, currentPrompt);
        const message = `Cassette prompt mismatch. Recorded hash: ${recordedHash}, Current hash: ${currentHash}, first diff at char ${diffAt}.`;
        log.debug(
          `Cassette prompt mismatch full strings:\n  Recorded: ${cassette.metadata.prompt}\n  Current:  ${currentPrompt}`
        );
        if (this.strict) {
          throw new Error(message);
        }
        log.warn(message);
      }

      if (
        currentToolDefsHash &&
        cassette.metadata.toolDefsHash &&
        cassette.metadata.toolDefsHash !== currentToolDefsHash
      ) {
        const message = `Cassette tool definitions mismatch. Recorded hash: "${cassette.metadata.toolDefsHash.slice(0, 16)}…", Current: "${currentToolDefsHash.slice(0, 16)}…". Tool definitions may have changed since this cassette was recorded.`;
        if (this.strict) {
          throw new Error(message);
        }
        log.warn(message);
      }
    }

    const { result } = cassette;

    // Apply stubs to trace calls
    const matchedStubs = new Set<CassetteStub>();
    const calls = result.trace.calls.map((call) => {
      const stub = this.stubs.find((s) => {
        if (s.at.toolName !== call.toolName) return false;
        if (s.at.sequenceIndex !== undefined && s.at.sequenceIndex !== call.sequenceIndex)
          return false;
        if (s.at.args !== undefined) {
          for (const [key, value] of Object.entries(s.at.args)) {
            if (JSON.stringify(call.args[key]) !== JSON.stringify(value)) return false;
          }
        }
        return true;
      });
      if (stub) {
        matchedStubs.add(stub);
        log.info(`Stub applied: ${call.toolName}@${call.sequenceIndex} → ${stub.return.type}`);
        return { ...call, result: stub.return };
      }
      return call;
    });

    for (const stub of this.stubs) {
      if (!matchedStubs.has(stub)) {
        log.warn(
          `Stub defined for "${stub.at.toolName}" did not match any call during cassette replay.`
        );
      }
    }

    const { metadata } = cassette;

    return {
      output: result.output,
      trace: {
        calls,
        totalCalls: result.trace.totalCalls ?? calls.length,
        totalDurationMs:
          result.trace.totalDurationMs ?? calls.reduce((sum, c) => sum + (c.durationMs ?? 0), 0),
      },
      messages: [...(result.messages ?? [])],
      usage:
        result.usage ??
        (metadata.source === 'skill_run'
          ? { inputTokens: 0, outputTokens: 0, model: metadata.model }
          : { inputTokens: 0, outputTokens: 0, model: 'unknown' }),
      duration: 0,
      cacheStatus: 'cassette_replay',
      runManifest:
        metadata.source === 'skill_run'
          ? ({
              skillHash: metadata.skillHash,
              promptHash: metadata.promptHash,
              toolDefsHash: metadata.toolDefsHash,
              provider: metadata.provider,
              model: metadata.model,
              temperature: metadata.temperature,
              frameworkVersion: metadata.frameworkVersion,
              driverVersion: metadata.driverVersion,
            } as RunManifest)
          : undefined,
    };
  }
}
