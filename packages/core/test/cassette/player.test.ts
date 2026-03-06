import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CassettePlayer } from '../../src/cassette/player.js';
import type { Cassette } from '../../src/cassette/types.js';

const TMP_DIR = join(import.meta.dirname, '__cassette_player_test__');

function makeCassette(overrides?: Partial<Cassette>): Cassette {
  return {
    version: 1,
    recordedAt: '2025-03-06T10:00:00Z',
    metadata: {
      skillHash: 'abc123',
      prompt: 'deploy the app',
      provider: 'openai',
      model: 'gpt-4o',
      frameworkVersion: '0.2.0',
    },
    result: {
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
        { role: 'user' as const, content: 'deploy the app' },
        { role: 'assistant' as const, content: 'Deployment complete.' },
      ],
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-4o',
      },
      duration: 2000,
    },
    ...overrides,
  } as Cassette;
}

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe('CassettePlayer', () => {
  it('replays recorded result', async () => {
    const filePath = join(TMP_DIR, 'test.cassette.json');
    await writeFile(filePath, JSON.stringify(makeCassette()));

    const player = new CassettePlayer(filePath);
    const result = await player.replay();

    expect(result.output).toBe('Deployment complete.');
    expect(result.trace.totalCalls).toBe(2);
    expect(result.trace.calls[0]?.toolName).toBe('bash');
  });

  it('preserves original token usage from cassette', async () => {
    const filePath = join(TMP_DIR, 'replay-tokens.cassette.json');
    await writeFile(filePath, JSON.stringify(makeCassette()));

    const player = new CassettePlayer(filePath);
    const result = await player.replay();

    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
  });

  it('rejects unsupported cassette version', async () => {
    const filePath = join(TMP_DIR, 'bad-version.cassette.json');
    const cassette = { ...makeCassette(), version: 99 };
    await writeFile(filePath, JSON.stringify(cassette));

    const player = new CassettePlayer(filePath);
    await expect(player.replay()).rejects.toThrow('Unsupported cassette version');
  });

  it('throws on missing file', async () => {
    const player = new CassettePlayer(join(TMP_DIR, 'nonexistent.json'));
    await expect(player.replay()).rejects.toThrow();
  });

  it('applies stubs to matching tool calls', async () => {
    const filePath = join(TMP_DIR, 'stub.cassette.json');
    await writeFile(filePath, JSON.stringify(makeCassette()));

    const player = new CassettePlayer(filePath, [
      {
        at: { sequenceIndex: 0, toolName: 'bash' },
        return: { type: 'error', message: 'ENOENT: file not found' },
      },
    ]);
    const result = await player.replay();

    expect(result.trace.calls[0]?.result).toEqual({
      type: 'error',
      message: 'ENOENT: file not found',
    });
    // Non-stubbed call unchanged
    expect(result.trace.calls[1]?.result).toEqual({
      type: 'success',
      content: 'ok',
    });
  });

  it('ignores stubs that do not match', async () => {
    const filePath = join(TMP_DIR, 'no-match.cassette.json');
    await writeFile(filePath, JSON.stringify(makeCassette()));

    const player = new CassettePlayer(filePath, [
      {
        at: { sequenceIndex: 5, toolName: 'nonexistent' },
        return: { type: 'error', message: 'should not apply' },
      },
    ]);
    const result = await player.replay();

    expect(result.trace.calls[0]?.result).toEqual({
      type: 'success',
      content: 'Build succeeded',
    });
  });
});
