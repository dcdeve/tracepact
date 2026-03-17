import { mkdirSync, writeFileSync } from 'node:fs';
import { type RedactionConfig, RedactionPipeline } from '@tracepact/core';
import type { File, Reporter } from 'vitest';
import { writeTokenReport } from './token-tracker.js';

interface TestResult {
  name: string;
  file: string;
  status: string;
  duration: number;
  error?: string;
}

export class TracepactJsonReporter implements Reporter {
  private results: TestResult[] = [];
  // Intentionally not built at construction time: RedactionPipeline captures
  // process.env once during construction, so building it lazily in onFinished()
  // ensures any secrets injected after reporter instantiation (dotenv lazy
  // loads, CI secret injection, test fixtures) are still redacted.
  private readonly redactionConfig: RedactionConfig | undefined;

  constructor(redactionConfig?: RedactionConfig) {
    this.redactionConfig = redactionConfig;
  }

  onFinished(files?: File[]) {
    if (!files) return;

    // Build the pipeline here so process.env is read after all test setup has
    // completed and any late-arriving secrets are present.
    const redaction = new RedactionPipeline(this.redactionConfig);

    for (const file of files) {
      this.collectTasks(file.tasks, file.filepath);
    }

    const output = {
      framework: 'tracepact',
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter((r) => r.status === 'pass').length,
        failed: this.results.filter((r) => r.status === 'fail').length,
        skipped: this.results.filter((r) => r.status === 'skip').length,
      },
      tests: this.results,
    };

    const redactedOutput = redaction.redactObject(output);
    mkdirSync('.tracepact', { recursive: true });
    writeFileSync('.tracepact/results.json', JSON.stringify(redactedOutput, null, 2));

    // Write token usage report (no-op if no live runs occurred)
    writeTokenReport();
  }

  private collectTasks(tasks: any[], filepath: string) {
    for (const task of tasks) {
      if (task.type === 'test') {
        this.results.push({
          name: task.name,
          file: filepath,
          status: task.result?.state ?? 'skip',
          duration: task.result?.duration ?? 0,
          error: task.result?.errors?.[0]?.message,
        });
      }
      // Recurse into suites
      if (task.tasks) {
        this.collectTasks(task.tasks, filepath);
      }
    }
  }
}
