import { readFile } from 'node:fs/promises';
import type { RunManifest } from '../cache/run-manifest.js';
import type { RunResult } from '../driver/types.js';
import { log } from '../logger.js';
import type { Cassette, CassetteStub } from './types.js';

export class CassettePlayer {
  private filePath: string;
  private stubs: CassetteStub[];
  private strict: boolean;

  constructor(filePath: string, stubs?: CassetteStub[], strict = true) {
    this.filePath = filePath;
    this.stubs = stubs ?? [];
    this.strict = strict;
  }

  async load(): Promise<Cassette> {
    const raw = await readFile(this.filePath, 'utf-8');
    const cassette: Cassette = JSON.parse(raw);

    switch (cassette.version) {
      case 1:
        return cassette;
      default:
        throw new Error(
          `Unsupported cassette version: ${cassette.version}. Supported versions: [1].`
        );
    }
  }

  async replay(currentPrompt?: string): Promise<RunResult> {
    const cassette = await this.load();

    if (currentPrompt && cassette.metadata.prompt !== currentPrompt) {
      const message = `Cassette prompt mismatch. Recorded: "${cassette.metadata.prompt.slice(0, 60)}…", Current: "${currentPrompt.slice(0, 60)}…"`;
      if (this.strict) {
        throw new Error(message);
      }
      log.warn(message);
    }

    const { result } = cassette;

    // Apply stubs to trace calls
    const calls = result.trace.calls.map((call) => {
      const stub = this.stubs.find((s) => {
        if (s.at.toolName !== call.toolName) return false;
        if (s.at.sequenceIndex !== undefined && s.at.sequenceIndex !== call.sequenceIndex)
          return false;
        if (s.at.args !== undefined) {
          for (const [key, value] of Object.entries(s.at.args)) {
            if (call.args[key] !== value) return false;
          }
        }
        return true;
      });
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
        promptHash: cassette.metadata.promptHash,
        toolDefsHash: cassette.metadata.toolDefsHash,
        provider: cassette.metadata.provider,
        model: cassette.metadata.model,
        temperature: cassette.metadata.temperature,
        frameworkVersion: cassette.metadata.frameworkVersion,
        driverVersion: cassette.metadata.driverVersion,
      } as RunManifest,
    };
  }
}
