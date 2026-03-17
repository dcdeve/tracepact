import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RedactionConfig } from '../config/types.js';
import type { RunResult } from '../driver/types.js';
import { log } from '../logger.js';
import { RedactionPipeline } from '../redaction/pipeline.js';
import type { Cassette, CassetteMetadata } from './types.js';

export class CassetteRecorder {
  private filePath: string;
  private readonly redaction: RedactionPipeline;

  constructor(filePath: string, redactionConfig?: RedactionConfig) {
    this.filePath = filePath;
    this.redaction = new RedactionPipeline(redactionConfig);
  }

  async save(result: RunResult, metadata: CassetteMetadata): Promise<void> {
    const cassette: Cassette = {
      version: 1,
      recordedAt: new Date().toISOString(),
      metadata,
      result: {
        output: result.output,
        trace: {
          calls: result.trace.calls.map((c) => ({
            toolName: c.toolName,
            args: c.args,
            result: c.result,
            durationMs: c.durationMs,
            sequenceIndex: c.sequenceIndex,
            unknownTool: c.unknownTool,
            ...(c.source ? { source: c.source } : {}),
          })),
          totalCalls: result.trace.totalCalls,
          totalDurationMs: result.trace.totalDurationMs,
        },
        messages: result.messages,
        usage: result.usage,
        duration: result.duration,
      },
    };

    const redactedCassette = this.redaction.redactObject(cassette);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(redactedCassette, null, 2), 'utf-8');
    log.info(`Cassette saved: ${this.filePath}`);
  }
}
