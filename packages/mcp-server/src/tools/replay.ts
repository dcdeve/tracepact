import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function handleReplay(args: { cassette_path: string }): {
  pass: boolean;
  trace: Record<string, unknown>;
  error?: string;
} {
  try {
    const raw = readFileSync(resolve(args.cassette_path), 'utf-8');
    const cassette = JSON.parse(raw);

    if (cassette.version !== 1) {
      return {
        pass: false,
        trace: {},
        error: `Unsupported cassette version: ${cassette.version}`,
      };
    }

    const result = cassette.result;
    const trace = result.trace ?? { calls: [], totalCalls: 0, totalDurationMs: 0 };

    return {
      pass: true,
      trace,
    };
  } catch (err: unknown) {
    console.error('[tracepact] replay failed:', err);
    throw err;
  }
}
