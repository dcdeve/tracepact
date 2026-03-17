import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CassettePlayer } from '../../src/cassette/player.js';
import { CassetteRecorder } from '../../src/cassette/recorder.js';
import type { Cassette } from '../../src/cassette/types.js';
import type { RunResult } from '../../src/driver/types.js';

const TMP_DIR = join(import.meta.dirname, '__cassette_test__');

function makeRunResult(overrides?: Partial<RunResult>): RunResult {
  return {
    output: 'Deployment complete.',
    trace: {
      calls: [
        {
          toolName: 'bash',
          args: { command: 'npm run build' },
          result: { type: 'success', content: 'Build succeeded' },
          durationMs: 500,
          sequenceIndex: 0,
          unknownTool: false,
        },
        {
          toolName: 'write_file',
          args: { path: '/app/deploy.log', content: 'done' },
          result: { type: 'success', content: 'ok' },
          durationMs: 10,
          sequenceIndex: 1,
          unknownTool: false,
        },
      ],
      totalCalls: 2,
      totalDurationMs: 510,
    },
    messages: [
      { role: 'user', content: 'deploy the app' },
      { role: 'assistant', content: 'Deployment complete.' },
    ],
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      model: 'gpt-4o',
    },
    duration: 2000,
    runManifest: {
      skillHash: 'abc123',
      promptHash: 'def456',
      toolDefsHash: 'ghi789',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      frameworkVersion: '0.2.0',
      driverVersion: 'openai-1.0.0',
    },
    ...overrides,
  };
}

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe('CassetteRecorder', () => {
  it('saves cassette to JSON file', async () => {
    const filePath = join(TMP_DIR, 'test.cassette.json');
    const recorder = new CassetteRecorder(filePath);
    const result = makeRunResult();

    await recorder.save(result, {
      source: 'skill_run',
      skillHash: 'abc123',
      prompt: 'deploy the app',
      promptHash: 'def456',
      toolDefsHash: 'ghi789',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      frameworkVersion: '0.2.0',
      driverVersion: 'openai-1.0.0',
    });

    const raw = await readFile(filePath, 'utf-8');
    const cassette: Cassette = JSON.parse(raw);
    expect(cassette.version).toBe(2);
    expect(cassette.metadata.source).toBe('skill_run');
    expect(cassette.result.output).toBe('Deployment complete.');
  });

  it('includes metadata in cassette', async () => {
    const filePath = join(TMP_DIR, 'meta.cassette.json');
    const recorder = new CassetteRecorder(filePath);

    await recorder.save(makeRunResult(), {
      source: 'skill_run',
      skillHash: 'abc123',
      prompt: 'deploy the app',
      promptHash: 'def456',
      toolDefsHash: 'ghi789',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      frameworkVersion: '0.2.0',
      driverVersion: 'openai-1.0.0',
    });

    const raw = await readFile(filePath, 'utf-8');
    const cassette: Cassette = JSON.parse(raw);
    expect(cassette.metadata.source).toBe('skill_run');
    if (cassette.metadata.source !== 'skill_run') throw new Error('unexpected');
    expect(cassette.metadata.prompt).toBe('deploy the app');
    expect(cassette.metadata.provider).toBe('openai');
    expect(cassette.metadata.model).toBe('gpt-4o');
    expect(cassette.recordedAt).toBeTruthy();
  });

  it('includes full trace in cassette', async () => {
    const filePath = join(TMP_DIR, 'trace.cassette.json');
    const recorder = new CassetteRecorder(filePath);

    await recorder.save(makeRunResult(), {
      source: 'skill_run',
      skillHash: 'abc123',
      prompt: 'deploy the app',
      promptHash: 'def456',
      toolDefsHash: 'ghi789',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      frameworkVersion: '0.2.0',
      driverVersion: 'openai-1.0.0',
    });

    const raw = await readFile(filePath, 'utf-8');
    const cassette: Cassette = JSON.parse(raw);
    expect(cassette.result.trace.totalCalls).toBe(2);
    expect(cassette.result.trace.calls[0]?.toolName).toBe('bash');
    expect(cassette.result.trace.calls[1]?.toolName).toBe('write_file');
  });

  it('record + replay preserves MCP source', async () => {
    const filePath = join(TMP_DIR, 'mcp-source.cassette.json');
    const recorder = new CassetteRecorder(filePath);

    const result = makeRunResult({
      trace: {
        calls: [
          {
            toolName: 'read_file',
            args: { path: '/a.txt' },
            result: { type: 'success', content: 'ok' },
            durationMs: 5,
            sequenceIndex: 0,
            unknownTool: false,
            source: { type: 'local' },
          },
          {
            toolName: 'query',
            args: { sql: 'SELECT 1' },
            result: { type: 'success', content: '1' },
            durationMs: 20,
            sequenceIndex: 1,
            unknownTool: false,
            source: { type: 'mcp', server: 'database' },
          },
        ],
        totalCalls: 2,
        totalDurationMs: 25,
      },
    });

    await recorder.save(result, {
      source: 'skill_run',
      skillHash: 'mcp123',
      prompt: 'test mcp',
      promptHash: 'mcp456',
      toolDefsHash: 'mcp789',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      frameworkVersion: '0.2.0',
      driverVersion: 'openai-1.0.0',
    });

    const player = new CassettePlayer(filePath);
    const replayed = await player.replay();

    expect(replayed.trace.totalCalls).toBe(2);
    expect(replayed.trace.calls[0]?.source).toEqual({ type: 'local' });
    expect(replayed.trace.calls[1]?.source).toEqual({ type: 'mcp', server: 'database' });
  });
});
