import { readFile } from 'node:fs/promises';
import type { RunManifest } from '../cache/run-manifest.js';
import type { RunResult } from '../driver/types.js';
import { log } from '../logger.js';
import type { Cassette, CassetteStub } from './types.js';

export class CassettePlayer {
  private filePath: string;
  private stubs: CassetteStub[];

  constructor(filePath: string, stubs?: CassetteStub[]) {
    this.filePath = filePath;
    this.stubs = stubs ?? [];
  }

  async load(): Promise<Cassette> {
    const raw = await readFile(this.filePath, 'utf-8');
    const cassette: Cassette = JSON.parse(raw);

    if (cassette.version !== 1) {
      throw new Error(`Unsupported cassette version: ${cassette.version}. Expected 1.`);
    }

    return cassette;
  }

  async replay(currentPrompt?: string): Promise<RunResult> {
    const cassette = await this.load();

    if (currentPrompt && cassette.metadata.prompt !== currentPrompt) {
      log.warn(
        `Cassette prompt mismatch. Recorded: "${cassette.metadata.prompt.slice(0, 60)}…", Current: "${currentPrompt.slice(0, 60)}…"`
      );
    }

    const { result } = cassette;

    // Apply stubs to trace calls
    const calls = result.trace.calls.map((call) => {
      const stub = this.stubs.find(
        (s) => s.at.sequenceIndex === call.sequenceIndex && s.at.toolName === call.toolName
      );
      if (stub) {
        log.info(`Stub applied: ${call.toolName}@${call.sequenceIndex} → ${stub.return.type}`);
        return { ...call, result: stub.return };
      }
      return call;
    });

    return {
      output: result.output,
      trace: {
        calls,
        totalCalls: result.trace.totalCalls ?? calls.length,
        totalDurationMs:
          result.trace.totalDurationMs ?? calls.reduce((sum, c) => sum + (c.durationMs ?? 0), 0),
      },
      messages: [...(result.messages ?? [])],
      usage: {
        ...(result.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
      },
      duration: 0,
      runManifest: {
        skillHash: cassette.metadata.skillHash,
        promptHash: '',
        toolDefsHash: '',
        provider: cassette.metadata.provider,
        model: cassette.metadata.model,
        temperature: 0,
        frameworkVersion: cassette.metadata.frameworkVersion,
        driverVersion: 'cassette-replay',
      } as RunManifest,
    };
  }
}
