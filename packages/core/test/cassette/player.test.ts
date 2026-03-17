import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CassettePlayer } from '../../src/cassette/player.js';

const TMP_DIR = join(import.meta.dirname, '__cassette_player_test__');

/** Shape of a v1 cassette (before the source discriminant was added). */
interface V1Cassette {
  version: 1;
  recordedAt: string;
  metadata: {
    skillHash: string;
    prompt: string;
    provider: string;
    model: string;
    frameworkVersion: string;
  };
  result: {
    output: string;
    trace: {
      calls: readonly {
        toolName: string;
        args: Record<string, unknown>;
        result: { type: 'success'; content: string } | { type: 'error'; message: string };
        durationMs: number;
        sequenceIndex: number;
        unknownTool: boolean;
      }[];
      totalCalls: number;
      totalDurationMs: number;
    };
    messages: readonly { role: 'user' | 'assistant'; content: string }[];
    usage: { inputTokens: number; outputTokens: number; model: string };
    duration: number;
  };
}

function makeV1Cassette(overrides?: Partial<V1Cassette>): V1Cassette {
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
  };
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
    await writeFile(filePath, JSON.stringify(makeV1Cassette()));

    const player = new CassettePlayer(filePath);
    const result = await player.replay();

    expect(result.output).toBe('Deployment complete.');
    expect(result.trace.totalCalls).toBe(2);
    expect(result.trace.calls[0]?.toolName).toBe('bash');
  });

  it('preserves original token usage from cassette', async () => {
    const filePath = join(TMP_DIR, 'replay-tokens.cassette.json');
    await writeFile(filePath, JSON.stringify(makeV1Cassette()));

    const player = new CassettePlayer(filePath);
    const result = await player.replay();

    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
  });

  it('rejects unsupported cassette version', async () => {
    const filePath = join(TMP_DIR, 'bad-version.cassette.json');
    const cassette = { ...makeV1Cassette(), version: 99 };
    await writeFile(filePath, JSON.stringify(cassette));

    const player = new CassettePlayer(filePath);
    await expect(player.replay()).rejects.toThrow('is newer than this library supports');
  });

  it('throws on missing file', async () => {
    const player = new CassettePlayer(join(TMP_DIR, 'nonexistent.json'));
    await expect(player.replay()).rejects.toThrow();
  });

  it('applies stubs to matching tool calls', async () => {
    const filePath = join(TMP_DIR, 'stub.cassette.json');
    await writeFile(filePath, JSON.stringify(makeV1Cassette()));

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
    await writeFile(filePath, JSON.stringify(makeV1Cassette()));

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

  it('migrates v1 cassette to v2 with source: skill_run', async () => {
    const filePath = join(TMP_DIR, 'v1-migrate.cassette.json');
    await writeFile(filePath, JSON.stringify(makeV1Cassette()));

    const player = new CassettePlayer(filePath);
    const cassette = await player.load();

    expect(cassette.version).toBe(2);
    expect(cassette.metadata.source).toBe('skill_run');
  });

  it('replays v1 cassette with runManifest', async () => {
    const filePath = join(TMP_DIR, 'v1-manifest.cassette.json');
    await writeFile(filePath, JSON.stringify(makeV1Cassette()));

    const player = new CassettePlayer(filePath);
    const result = await player.replay();

    expect(result.runManifest).toBeDefined();
    expect(result.runManifest?.provider).toBe('openai');
  });

  it('replays observed cassette without runManifest', async () => {
    const filePath = join(TMP_DIR, 'observed.cassette.json');
    const observed = {
      version: 2,
      recordedAt: '2025-03-06T10:00:00Z',
      metadata: {
        source: 'observed',
        sessionId: 'sess-123',
        tool: 'claude-code',
      },
      result: makeV1Cassette().result,
    };
    await writeFile(filePath, JSON.stringify(observed));

    const player = new CassettePlayer(filePath);
    const result = await player.replay();

    expect(result.runManifest).toBeUndefined();
    expect(result.output).toBe('Deployment complete.');
    expect(result.cacheStatus).toBe('cassette_replay');
  });

  it('skips prompt validation for observed cassettes', async () => {
    const filePath = join(TMP_DIR, 'observed-no-validate.cassette.json');
    const observed = {
      version: 2,
      recordedAt: '2025-03-06T10:00:00Z',
      metadata: {
        source: 'observed',
        sessionId: 'sess-456',
      },
      result: makeV1Cassette().result,
    };
    await writeFile(filePath, JSON.stringify(observed));

    const player = new CassettePlayer(filePath, [], true);
    // Should not throw even in strict mode — observed cassettes skip validation
    const result = await player.replay('any prompt', 'any-hash');
    expect(result.output).toBe('Deployment complete.');
  });

  it('throws on v1 cassette with missing metadata', async () => {
    const filePath = join(TMP_DIR, 'v1-no-metadata.cassette.json');
    const malformed = {
      version: 1,
      recordedAt: '2025-01-01T00:00:00Z',
      result: makeV1Cassette().result,
    };
    await writeFile(filePath, JSON.stringify(malformed));

    const player = new CassettePlayer(filePath);
    await expect(player.load()).rejects.toThrow('missing or invalid "metadata"');
  });
});
