import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diffCassettes } from '../../src/cassette/diff.js';

const TMP_DIR = join(import.meta.dirname, '__diff_test__');

function makeCassette(calls: Array<{ toolName: string; args: Record<string, unknown> }>) {
  return {
    version: 1,
    recordedAt: new Date().toISOString(),
    metadata: {
      skillHash: 'abc',
      prompt: 'test prompt',
      provider: 'openai',
      model: 'gpt-4o',
      frameworkVersion: '0.3.0',
    },
    result: {
      output: 'done',
      trace: {
        calls: calls.map((c, i) => ({
          toolName: c.toolName,
          args: c.args,
          result: { type: 'success', content: 'ok' },
          durationMs: 10,
          sequenceIndex: i,
          unknownTool: false,
        })),
        totalCalls: calls.length,
        totalDurationMs: calls.length * 10,
      },
      messages: [],
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      duration: 1000,
    },
  };
}

async function writeCassette(name: string, cassette: ReturnType<typeof makeCassette>) {
  const path = join(TMP_DIR, name);
  await writeFile(path, JSON.stringify(cassette, null, 2));
  return path;
}

describe('diffCassettes', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it('reports no changes for identical cassettes', async () => {
    const calls = [
      { toolName: 'read_file', args: { path: 'config.yaml' } },
      { toolName: 'deploy', args: { env: 'staging' } },
    ];
    const pathA = await writeCassette('a.json', makeCassette(calls));
    const pathB = await writeCassette('b.json', makeCassette(calls));

    const result = await diffCassettes(pathA, pathB);

    expect(result.changed).toBe(false);
    expect(result.severity).toBe('none');
    expect(result.additions).toHaveLength(0);
    expect(result.removals).toHaveLength(0);
    expect(result.diffs).toHaveLength(0);
  });

  it('detects added tool calls', async () => {
    const callsA = [{ toolName: 'read_file', args: { path: 'config.yaml' } }];
    const callsB = [
      { toolName: 'read_file', args: { path: 'config.yaml' } },
      { toolName: 'deploy', args: { env: 'staging' } },
    ];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB);

    expect(result.changed).toBe(true);
    expect(result.severity).toBe('block');
    expect(result.additions).toHaveLength(1);
    expect(result.additions[0]?.toolName).toBe('deploy');
    expect(result.removals).toHaveLength(0);
  });

  it('detects removed tool calls', async () => {
    const callsA = [
      { toolName: 'read_file', args: { path: 'config.yaml' } },
      { toolName: 'bash', args: { cmd: 'npm test' } },
    ];
    const callsB = [{ toolName: 'read_file', args: { path: 'config.yaml' } }];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB);

    expect(result.changed).toBe(true);
    expect(result.severity).toBe('block');
    expect(result.removals).toHaveLength(1);
    expect(result.removals[0]?.toolName).toBe('bash');
  });

  it('detects tool name changes at same index', async () => {
    const callsA = [{ toolName: 'bash', args: { cmd: 'npm test' } }];
    const callsB = [{ toolName: 'deploy', args: { env: 'staging' } }];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB);

    expect(result.changed).toBe(true);
    expect(result.removals).toHaveLength(1);
    expect(result.removals[0]?.toolName).toBe('bash');
    expect(result.additions).toHaveLength(1);
    expect(result.additions[0]?.toolName).toBe('deploy');
  });

  it('detects argument changes', async () => {
    const callsA = [{ toolName: 'bash', args: { cmd: 'npm test' } }];
    const callsB = [{ toolName: 'bash', args: { cmd: 'npm run build' } }];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB);

    expect(result.changed).toBe(true);
    expect(result.severity).toBe('warn');
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.key).toBe('cmd');
    expect(result.diffs[0]?.a).toBe('npm test');
    expect(result.diffs[0]?.b).toBe('npm run build');
  });

  it('detects added arguments', async () => {
    const callsA = [{ toolName: 'deploy', args: { env: 'staging' } }];
    const callsB = [{ toolName: 'deploy', args: { env: 'staging', force: true } }];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB);

    expect(result.changed).toBe(true);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.key).toBe('force');
    expect(result.diffs[0]?.a).toBeUndefined();
    expect(result.diffs[0]?.b).toBe(true);
  });

  it('includes metadata from both cassettes', async () => {
    const cassetteA = makeCassette([{ toolName: 'read_file', args: { path: 'a.ts' } }]);
    cassetteA.metadata.model = 'gpt-4o';
    const cassetteB = makeCassette([{ toolName: 'read_file', args: { path: 'a.ts' } }]);
    cassetteB.metadata.model = 'claude-sonnet-4-5-20250929';

    const pathA = await writeCassette('a.json', cassetteA);
    const pathB = await writeCassette('b.json', cassetteB);

    const result = await diffCassettes(pathA, pathB);

    expect(result.metadata?.a.model).toBe('gpt-4o');
    expect(result.metadata?.b.model).toBe('claude-sonnet-4-5-20250929');
  });

  it('throws on missing file', async () => {
    const pathA = await writeCassette('a.json', makeCassette([]));
    await expect(diffCassettes(pathA, '/nonexistent.json')).rejects.toThrow();
  });

  it('handles empty traces', async () => {
    const pathA = await writeCassette('a.json', makeCassette([]));
    const pathB = await writeCassette('b.json', makeCassette([]));

    const result = await diffCassettes(pathA, pathB);

    expect(result.changed).toBe(false);
    expect(result.severity).toBe('none');
  });

  it('ignoreKeys filters out specified arg keys', async () => {
    const callsA = [{ toolName: 'bash', args: { cmd: 'npm test', timestamp: '100' } }];
    const callsB = [{ toolName: 'bash', args: { cmd: 'npm test', timestamp: '200' } }];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB, { ignoreKeys: ['timestamp'] });

    expect(result.changed).toBe(false);
    expect(result.severity).toBe('none');
    expect(result.diffs).toHaveLength(0);
  });

  it('ignoreKeys still reports non-ignored key changes', async () => {
    const callsA = [{ toolName: 'bash', args: { cmd: 'npm test', timestamp: '100' } }];
    const callsB = [{ toolName: 'bash', args: { cmd: 'npm run build', timestamp: '200' } }];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB, { ignoreKeys: ['timestamp'] });

    expect(result.changed).toBe(true);
    expect(result.severity).toBe('warn');
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.key).toBe('cmd');
  });

  it('ignoreTools excludes tools from comparison', async () => {
    const callsA = [
      { toolName: 'read_file', args: { path: 'a.ts' } },
      { toolName: 'bash', args: { cmd: 'npm test' } },
    ];
    const callsB = [{ toolName: 'bash', args: { cmd: 'npm test' } }];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB, { ignoreTools: ['read_file'] });

    expect(result.changed).toBe(false);
    expect(result.severity).toBe('none');
  });

  it('ignoreTools still reports changes on non-ignored tools', async () => {
    const callsA = [
      { toolName: 'read_file', args: { path: 'a.ts' } },
      { toolName: 'bash', args: { cmd: 'npm test' } },
    ];
    const callsB = [{ toolName: 'bash', args: { cmd: 'npm run build' } }];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB, { ignoreTools: ['read_file'] });

    expect(result.changed).toBe(true);
    expect(result.severity).toBe('warn');
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.key).toBe('cmd');
  });

  it('severity is block when tools added and args changed', async () => {
    const callsA = [{ toolName: 'bash', args: { cmd: 'npm test' } }];
    const callsB = [
      { toolName: 'bash', args: { cmd: 'npm run build' } },
      { toolName: 'deploy', args: { env: 'prod' } },
    ];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB);

    expect(result.severity).toBe('block');
    expect(result.additions).toHaveLength(1);
    expect(result.diffs).toHaveLength(1);
  });

  it('combined ignoreKeys and ignoreTools', async () => {
    const callsA = [
      { toolName: 'read_file', args: { path: 'a.ts' } },
      { toolName: 'bash', args: { cmd: 'npm test', requestId: 'abc' } },
    ];
    const callsB = [
      { toolName: 'read_file', args: { path: 'b.ts' } },
      { toolName: 'bash', args: { cmd: 'npm test', requestId: 'xyz' } },
    ];
    const pathA = await writeCassette('a.json', makeCassette(callsA));
    const pathB = await writeCassette('b.json', makeCassette(callsB));

    const result = await diffCassettes(pathA, pathB, {
      ignoreTools: ['read_file'],
      ignoreKeys: ['requestId'],
    });

    expect(result.changed).toBe(false);
    expect(result.severity).toBe('none');
  });
});
