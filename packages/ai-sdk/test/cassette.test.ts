import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CassetteBridge } from '../src/cassette.js';
import { wrapModel } from '../src/wrap-model.js';

// ---------- helpers ----------

let tmpFiles: string[] = [];

function tmpPath(name: string): string {
  const p = join(
    tmpdir(),
    `tracepact-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name
  );
  tmpFiles.push(p);
  return p;
}

afterEach(async () => {
  for (const p of tmpFiles) {
    // Remove parent dir (includes any .tmp files)
    const parent = join(p, '..');
    await rm(parent, { recursive: true, force: true }).catch(() => {});
  }
  tmpFiles = [];
});

function makeUsage(input = 10, output = 5): LanguageModelV3Usage {
  return {
    inputTokens: { total: input, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: output, text: undefined, reasoning: undefined },
  };
}

function toolCallResponse(
  calls: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  usage?: LanguageModelV3Usage
): LanguageModelV3GenerateResult {
  return {
    content: calls.map((c) => ({
      type: 'tool-call' as const,
      toolCallId: c.id,
      toolName: c.name,
      input: JSON.stringify(c.input),
    })),
    finishReason: { unified: 'tool-calls', raw: undefined },
    usage: usage ?? makeUsage(),
    warnings: [],
  };
}

function textResponse(text: string, usage?: LanguageModelV3Usage): LanguageModelV3GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: undefined },
    usage: usage ?? makeUsage(),
    warnings: [],
  };
}

function createMockModel(responses: LanguageModelV3GenerateResult[]): LanguageModelV3 {
  let callIdx = 0;
  return {
    specificationVersion: 'v3',
    provider: 'test-provider',
    modelId: 'test-model',
    supportedUrls: {},
    doGenerate: vi.fn(async () => {
      const resp = responses[callIdx] ?? responses.at(-1);
      callIdx++;
      return resp;
    }),
    doStream: vi.fn(async () => {
      throw new Error('doStream not implemented in mock');
    }),
  };
}

function buildPromptTurn1(): LanguageModelV3CallOptions {
  return {
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'Fix the bug' }] }],
  };
}

function buildPromptTurn2(): LanguageModelV3CallOptions {
  return {
    prompt: [
      { role: 'user', content: [{ type: 'text', text: 'Fix the bug' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc1',
            toolName: 'read_file',
            input: { path: 'app.ts' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            toolName: 'read_file',
            output: { type: 'text', value: 'const x = 1;' },
          },
        ],
      },
    ],
  };
}

function buildPromptTurn3(): LanguageModelV3CallOptions {
  return {
    prompt: [
      { role: 'user', content: [{ type: 'text', text: 'Fix the bug' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc1',
            toolName: 'read_file',
            input: { path: 'app.ts' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            toolName: 'read_file',
            output: { type: 'text', value: 'const x = 1;' },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc2',
            toolName: 'edit_file',
            input: { path: 'app.ts', content: 'const x = 2;' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc2',
            toolName: 'edit_file',
            output: { type: 'text', value: 'ok' },
          },
        ],
      },
    ],
  };
}

// ---------- tests ----------

describe('CassetteBridge round-trip', () => {
  it('records a 2-turn agent loop then replays it with matching content and finishReason', async () => {
    const cassettePath = tmpPath('round-trip.json');
    const inner = createMockModel([
      toolCallResponse([{ id: 'tc1', name: 'read_file', input: { path: 'app.ts' } }]),
      textResponse('Bug fixed.'),
    ]);

    // --- RECORD ---
    const { model: recordModel } = wrapModel(inner, {
      cassette: cassettePath,
      mode: 'record',
    });

    // Turn 1: user prompt -> model calls read_file
    const r1 = await recordModel.doGenerate(buildPromptTurn1());
    expect(r1.finishReason.unified).toBe('tool-calls');
    expect(r1.content[0]).toMatchObject({ type: 'tool-call', toolName: 'read_file' });

    // Turn 2: tool result -> model responds with text
    const r2 = await recordModel.doGenerate(buildPromptTurn2());
    expect(r2.finishReason.unified).toBe('stop');
    expect(r2.content[0]).toMatchObject({ type: 'text', text: 'Bug fixed.' });

    // Verify cassette file was written
    const raw = await readFile(cassettePath, 'utf-8');
    const cassette = JSON.parse(raw);
    expect(cassette.version).toBe(2);
    expect(cassette.metadata.source).toBe('observed');
    expect(cassette.result.messages.length).toBeGreaterThan(0);

    // --- REPLAY ---
    const dummyInner = createMockModel([]);
    const { model: replayModel } = wrapModel(dummyInner, {
      cassette: cassettePath,
      mode: 'auto', // auto should resolve to replay because file exists
    });

    // Replay turn 1
    const replay1 = await replayModel.doGenerate(buildPromptTurn1());
    expect(replay1.finishReason.unified).toBe(r1.finishReason.unified);
    expect(replay1.content).toHaveLength(r1.content.length);

    const replayToolCall = replay1.content[0];
    const origToolCall = r1.content[0];
    expect(replayToolCall).toBeDefined();
    expect(origToolCall).toBeDefined();
    if (replayToolCall?.type === 'tool-call' && origToolCall?.type === 'tool-call') {
      expect(replayToolCall.toolName).toBe(origToolCall.toolName);
      // input is stringified JSON in V3 content; parse to compare values
      expect(JSON.parse(replayToolCall.input)).toEqual(JSON.parse(origToolCall.input));
    }

    // Replay turn 2
    const replay2 = await replayModel.doGenerate(buildPromptTurn2());
    expect(replay2.finishReason.unified).toBe('stop');
    expect(replay2.content[0]).toMatchObject({ type: 'text', text: 'Bug fixed.' });

    // Verify the dummy inner model was never called (all replayed)
    expect(dummyInner.doGenerate).not.toHaveBeenCalled();
  });

  it('records a single text response and replays it correctly', async () => {
    const cassettePath = tmpPath('text-only.json');
    const inner = createMockModel([textResponse('Hello world')]);

    // Record
    const { model: recModel } = wrapModel(inner, { cassette: cassettePath, mode: 'record' });
    await recModel.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hello' }] }],
    });

    // Replay
    const dummy = createMockModel([]);
    const { model: repModel } = wrapModel(dummy, { cassette: cassettePath, mode: 'replay' });
    const result = await repModel.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hello' }] }],
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'Hello world' });
    expect(result.finishReason.unified).toBe('stop');
  });

  it('records tool_use + text and replays with correct content types and finish reasons', async () => {
    const cassettePath = tmpPath('tool-and-text.json');
    const inner = createMockModel([
      toolCallResponse([{ id: 'tc1', name: 'get_weather', input: { city: 'NYC' } }]),
      textResponse('The weather in NYC is sunny.'),
    ]);

    // Record
    const { model: recModel } = wrapModel(inner, { cassette: cassettePath, mode: 'record' });
    await recModel.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Weather?' }] }],
    });
    await recModel.doGenerate({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Weather?' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'tc1',
              toolName: 'get_weather',
              input: { city: 'NYC' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'tc1',
              toolName: 'get_weather',
              output: { type: 'text', value: 'sunny, 72F' },
            },
          ],
        },
      ],
    });

    // Replay
    const dummy = createMockModel([]);
    const { model: repModel } = wrapModel(dummy, { cassette: cassettePath, mode: 'replay' });

    const rep1 = await repModel.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Weather?' }] }],
    });
    expect(rep1.finishReason.unified).toBe('tool-calls');
    expect(rep1.content[0]?.type).toBe('tool-call');

    const rep2 = await repModel.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Weather?' }] }],
    });
    expect(rep2.finishReason.unified).toBe('stop');
    expect(rep2.content[0]).toMatchObject({ type: 'text', text: 'The weather in NYC is sunny.' });
  });
});

describe('CassetteBridge.getReplayTurn() exhaustion', () => {
  it('throws when replay turns are exhausted', async () => {
    const cassettePath = tmpPath('exhaustion.json');
    const inner = createMockModel([textResponse('Done')]);

    // Record a single-turn cassette
    const { model: recModel } = wrapModel(inner, { cassette: cassettePath, mode: 'record' });
    await recModel.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Do it' }] }],
    });

    // Load via CassetteBridge directly
    const bridge = new CassetteBridge({ filePath: cassettePath, mode: 'replay' });
    const resolved = await bridge.init();
    expect(resolved).toBe('replay');

    // First call succeeds
    const turn = bridge.getReplayTurn();
    expect(turn.content[0]).toMatchObject({ type: 'text', text: 'Done' });

    // Second call throws
    expect(() => bridge.getReplayTurn()).toThrow('replay exhausted');
  });

  it('throws "replay turns not loaded" if getReplayTurn called before init', () => {
    const bridge = new CassetteBridge({ filePath: '/nonexistent', mode: 'replay' });
    expect(() => bridge.getReplayTurn()).toThrow('replay turns not loaded');
  });
});

describe('CassetteBridge.init() auto-mode', () => {
  it('resolves to replay when cassette file exists', async () => {
    const cassettePath = tmpPath('auto-replay.json');

    // Write a minimal valid cassette
    const inner = createMockModel([textResponse('Existing')]);
    const { model } = wrapModel(inner, { cassette: cassettePath, mode: 'record' });
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    });

    // Now init a new bridge in auto mode
    const bridge = new CassetteBridge({ filePath: cassettePath, mode: 'auto' });
    const resolved = await bridge.init();
    expect(resolved).toBe('replay');
    expect(bridge.isReplay()).toBe(true);
  });

  it('resolves to record when cassette file does not exist', async () => {
    const cassettePath = tmpPath('auto-record.json');

    const bridge = new CassetteBridge({ filePath: cassettePath, mode: 'auto' });
    const resolved = await bridge.init();
    expect(resolved).toBe('record');
    expect(bridge.isReplay()).toBe(false);
  });

  it('resolves to record when mode is explicitly "record"', async () => {
    const cassettePath = tmpPath('explicit-record.json');

    const bridge = new CassetteBridge({ filePath: cassettePath, mode: 'record' });
    const resolved = await bridge.init();
    expect(resolved).toBe('record');
    expect(bridge.isReplay()).toBe(false);
  });

  it('resolves to replay when mode is explicitly "replay"', async () => {
    const cassettePath = tmpPath('explicit-replay.json');

    // Need to create the file first
    const inner = createMockModel([textResponse('Data')]);
    const { model } = wrapModel(inner, { cassette: cassettePath, mode: 'record' });
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Go' }] }],
    });

    const bridge = new CassetteBridge({ filePath: cassettePath, mode: 'replay' });
    const resolved = await bridge.init();
    expect(resolved).toBe('replay');
    expect(bridge.isReplay()).toBe(true);
  });
});

describe('doStream replay-mode rejection', () => {
  it('throws when doStream is called in replay mode', async () => {
    const cassettePath = tmpPath('stream-reject.json');

    // Record a cassette first
    const inner = createMockModel([textResponse('Streamed')]);
    const { model: recModel } = wrapModel(inner, { cassette: cassettePath, mode: 'record' });
    await recModel.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Stream it' }] }],
    });

    // Create a replay model and try doStream
    const dummy = createMockModel([]);
    const { model: repModel } = wrapModel(dummy, { cassette: cassettePath, mode: 'replay' });

    await expect(
      repModel.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Stream it' }] }],
      })
    ).rejects.toThrow('doStream is not supported in replay mode');
  });
});

describe('splitUsage via replay', () => {
  it('splits usage evenly across turns in a single-turn cassette', async () => {
    const cassettePath = tmpPath('usage-1turn.json');
    const inner = createMockModel([textResponse('Result', makeUsage(100, 50))]);

    const { model: recModel } = wrapModel(inner, { cassette: cassettePath, mode: 'record' });
    await recModel.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Go' }] }],
    });

    // Replay and check usage
    const dummy = createMockModel([]);
    const { model: repModel } = wrapModel(dummy, { cassette: cassettePath, mode: 'replay' });
    const result = await repModel.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Go' }] }],
    });

    // Single turn: full usage goes to the single turn
    expect(result.usage.inputTokens.total).toBe(100);
    expect(result.usage.outputTokens.total).toBe(50);
  });

  it('splits usage across turns in a 3-turn cassette', async () => {
    const cassettePath = tmpPath('usage-3turn.json');
    const inner = createMockModel([
      toolCallResponse(
        [{ id: 'tc1', name: 'read_file', input: { path: 'a.ts' } }],
        makeUsage(30, 15)
      ),
      toolCallResponse(
        [{ id: 'tc2', name: 'edit_file', input: { path: 'a.ts', content: 'x' } }],
        makeUsage(30, 15)
      ),
      textResponse('All done.', makeUsage(30, 15)),
    ]);

    // Record 3-turn conversation
    const { model: recModel } = wrapModel(inner, { cassette: cassettePath, mode: 'record' });

    await recModel.doGenerate(buildPromptTurn1());
    await recModel.doGenerate(buildPromptTurn2());
    await recModel.doGenerate(buildPromptTurn3());

    // Replay and check that each turn has split usage
    const dummy = createMockModel([]);
    const { model: repModel } = wrapModel(dummy, { cassette: cassettePath, mode: 'replay' });

    const rep1 = await repModel.doGenerate(buildPromptTurn1());
    const rep2 = await repModel.doGenerate(buildPromptTurn2());
    const rep3 = await repModel.doGenerate(buildPromptTurn3());

    // Usage was accumulated: 30+30+30 = 90 input, 15+15+15 = 45 output
    // Split across 3 assistant turns: ceil(90/3)=30 per turn, ceil(45/3)=15 per turn
    expect(rep1.usage.inputTokens.total).toBe(30);
    expect(rep1.usage.outputTokens.total).toBe(15);
    expect(rep2.usage.inputTokens.total).toBe(30);
    expect(rep2.usage.outputTokens.total).toBe(15);
    expect(rep3.usage.inputTokens.total).toBe(30);
    expect(rep3.usage.outputTokens.total).toBe(15);
  });
});
