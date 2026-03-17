import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeTrace, generateTestFile, parseSkill } from '@tracepact/core';
import type { GenerateOptions } from '@tracepact/core';

export async function handleCapture(args: {
  skill_path: string;
  prompt: string;
  cassette_path?: string | undefined;
}): Promise<{
  testFile: string;
  cassettePath: string;
  assertionsGenerated: number;
  error?: string;
}> {
  try {
    await parseSkill(args.skill_path);
    const skillBase = args.skill_path.replace(/\.(md|yaml)$/, '');
    const cassettePath = args.cassette_path ?? `./cassettes/${skillBase}.json`;

    // Check if cassette exists — if so, generate from it (dry-run mode)
    let cassette: Record<string, unknown>;
    try {
      const raw = readFileSync(resolve(cassettePath), 'utf-8');
      cassette = JSON.parse(raw);
    } catch {
      return {
        testFile: '',
        cassettePath,
        assertionsGenerated: 0,
        error: `No cassette found at ${cassettePath}. Record one first with: tracepact run --record`,
      };
    }

    const result = cassette.result as Record<string, unknown>;
    const trace = result.trace as Record<string, unknown>;
    const calls = trace.calls as Array<{ durationMs: number }>;

    const traceData = {
      calls,
      totalCalls: calls.length,
      totalDurationMs: calls.reduce((sum, c) => sum + c.durationMs, 0),
    };

    const output = (result.output as string) ?? '';
    const analysis = analyzeTrace(
      traceData as unknown as Parameters<typeof analyzeTrace>[0],
      output
    );

    const genOpts: GenerateOptions = {
      testName: args.prompt,
      skillPath: args.skill_path,
      cassettePath,
      withSemantic: true,
    };

    const testFile = generateTestFile(analysis, genOpts);

    return {
      testFile,
      cassettePath,
      assertionsGenerated: analysis.assertions.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      testFile: '',
      cassettePath: '',
      assertionsGenerated: 0,
      error: message,
    };
  }
}
