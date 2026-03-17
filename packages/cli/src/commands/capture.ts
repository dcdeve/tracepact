import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  CassettePlayer,
  MockSandbox,
  analyzeTrace,
  executePrompt,
  generateTestFile,
  parseSkill,
} from '@tracepact/core';
import type { GenerateOptions, TypedToolDefinition } from '@tracepact/core';

interface CaptureOptions {
  skill: string;
  prompt: string;
  out?: string;
  cassette?: string;
  withSemantic?: boolean;
  dryRun?: boolean;
  provider?: string;
}

/**
 * Build permissive tool definitions from skill frontmatter.
 * These accept any arguments so the LLM can call tools freely during capture.
 */
function buildPermissiveTools(toolNames: readonly string[]): TypedToolDefinition[] {
  return toolNames.map((name) => ({
    name,
    schema: {},
    jsonSchema: {
      type: 'object' as const,
      properties: {} as Record<string, unknown>,
      additionalProperties: true,
    },
  }));
}

/**
 * Build a MockSandbox where all tools return a stub response.
 */
function buildCaptureSandbox(toolNames: readonly string[]): MockSandbox {
  const defs = Object.fromEntries(
    toolNames.map((name) => [
      name,
      () => ({ type: 'success' as const, content: '(captured — no real execution)' }),
    ])
  );
  return new MockSandbox(defs);
}

export async function capture(opts: CaptureOptions): Promise<void> {
  const skillBase = opts.skill.replace(/\.(md|yaml)$/, '');
  const out = opts.out ?? `${skillBase}.test.ts`;
  const cassettePath = opts.cassette ?? `./cassettes/${skillBase}.json`;
  const withSemantic = opts.withSemantic ?? false;

  console.log('tracepact capture');
  console.log(`  skill:     ${opts.skill}`);
  console.log(`  prompt:    ${opts.prompt}`);
  console.log(`  cassette:  ${cassettePath}`);
  console.log(`  out:       ${out}`);
  if (withSemantic) console.log('  semantic:  enabled');
  if (opts.dryRun) console.log('  dry-run:   enabled');
  console.log('');

  const skill = await parseSkill(opts.skill);
  console.log(`Parsed skill: ${skill.frontmatter.name ?? opts.skill}`);

  if (opts.dryRun) {
    await generateFromCassette(cassettePath, {
      skill: opts.skill,
      prompt: opts.prompt,
      out,
      withSemantic,
    });
    return;
  }

  // Live capture: execute prompt directly against the LLM
  const toolNames = skill.frontmatter.tools ?? [];
  const tools = buildPermissiveTools(toolNames);
  const sandbox = buildCaptureSandbox(toolNames);

  console.log(`\nExecuting prompt against LLM (${toolNames.length} tools available)...\n`);

  const result = await executePrompt(skill, {
    prompt: opts.prompt,
    tools,
    sandbox,
    record: resolve(cassettePath),
    healthCheck: true,
    ...(opts.provider ? { provider: opts.provider } : {}),
  });

  console.log(
    `Done. ${result.trace.totalCalls} tool calls, ${result.usage.inputTokens + result.usage.outputTokens} tokens used.`
  );

  await generateFromCassette(cassettePath, {
    skill: opts.skill,
    prompt: opts.prompt,
    out,
    withSemantic,
  });
}

interface GenOpts {
  skill: string;
  prompt: string;
  out: string;
  withSemantic: boolean;
}

async function generateFromCassette(cassettePath: string, opts: GenOpts): Promise<void> {
  console.log('\nReading cassette...');
  const cassette = await new CassettePlayer(resolve(cassettePath)).load();

  const trace = {
    calls: cassette.result.trace.calls,
    totalCalls: cassette.result.trace.calls.length,
    totalDurationMs: cassette.result.trace.calls.reduce(
      (sum: number, c: { durationMs: number }) => sum + c.durationMs,
      0
    ),
  };

  const output = cassette.result.output ?? '';
  const analysis = analyzeTrace(trace, output);

  const genOpts: GenerateOptions = {
    testName: opts.prompt,
    skillPath: opts.skill,
    cassettePath,
    withSemantic: opts.withSemantic,
  };

  const testFile = generateTestFile(analysis, genOpts);

  console.log('\n--- Generated test file ---\n');
  console.log(testFile);

  mkdirSync(dirname(resolve(opts.out)), { recursive: true });
  writeFileSync(resolve(opts.out), testFile, 'utf-8');
  console.log(`\nWritten to ${opts.out}`);
}
