import type {
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3Prompt,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { Tracker, mapToolResultOutput } from '../src/tracker.js';

// ---------- helpers ----------

function makeUsage(input = 10, output = 5): LanguageModelV3Usage {
  return {
    inputTokens: { total: input, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: output, text: undefined, reasoning: undefined },
  };
}

function makeCallOptions(prompt: LanguageModelV3Prompt): LanguageModelV3CallOptions {
  return { prompt };
}

function toolCallResult(
  parts: LanguageModelV3GenerateResult['content']
): LanguageModelV3GenerateResult {
  return {
    content: parts,
    finishReason: { unified: 'tool-calls', raw: undefined },
    usage: makeUsage(),
    warnings: [],
  };
}

function textResult(text: string, usage?: LanguageModelV3Usage): LanguageModelV3GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: undefined },
    usage: usage ?? makeUsage(),
    warnings: [],
  };
}

// ---------- mapToolResultOutput ----------

describe('mapToolResultOutput', () => {
  it('maps text output', () => {
    expect(mapToolResultOutput({ type: 'text', value: 'hello' })).toEqual({
      type: 'success',
      content: 'hello',
    });
  });

  it('maps json output', () => {
    expect(mapToolResultOutput({ type: 'json', value: { key: 'val' } })).toEqual({
      type: 'success',
      content: '{"key":"val"}',
    });
  });

  it('maps content output — extracts text parts', () => {
    expect(
      mapToolResultOutput({
        type: 'content',
        value: [
          { type: 'text', text: 'line 1' },
          { type: 'image-url', url: 'https://example.com/img.png' },
          { type: 'text', text: 'line 2' },
        ],
      })
    ).toEqual({
      type: 'success',
      content: 'line 1line 2',
    });
  });

  it('maps error-text output', () => {
    expect(mapToolResultOutput({ type: 'error-text', value: 'not found' })).toEqual({
      type: 'error',
      message: 'not found',
    });
  });

  it('maps error-json output', () => {
    expect(mapToolResultOutput({ type: 'error-json', value: { code: 404 } })).toEqual({
      type: 'error',
      message: '{"code":404}',
    });
  });

  it('maps execution-denied output', () => {
    expect(mapToolResultOutput({ type: 'execution-denied', reason: 'blocked' })).toEqual({
      type: 'error',
      message: 'blocked',
    });
  });

  it('maps execution-denied without reason', () => {
    expect(mapToolResultOutput({ type: 'execution-denied' })).toEqual({
      type: 'error',
      message: 'execution denied',
    });
  });
});

// ---------- Tracker ----------

describe('Tracker', () => {
  it('tracks a single tool call across two turns', () => {
    const tracker = new Tracker();

    // Turn 1: model calls read_file
    const turn1Options = makeCallOptions([
      { role: 'user', content: [{ type: 'text', text: 'Read the config' }] },
    ]);
    tracker.beforeGenerate(turn1Options);

    const turn1Result = toolCallResult([
      {
        type: 'tool-call',
        toolCallId: 'tc1',
        toolName: 'read_file',
        input: '{"path":"config.json"}',
      },
    ]);
    tracker.afterGenerate(turn1Result);

    // Turn 2: tool result comes back, model responds with text
    const turn2Options = makeCallOptions([
      { role: 'user', content: [{ type: 'text', text: 'Read the config' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc1',
            toolName: 'read_file',
            input: { path: 'config.json' },
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
            output: { type: 'text', value: '{"port":3000}' },
          },
        ],
      },
    ]);
    tracker.beforeGenerate(turn2Options);

    const turn2Result = textResult('The config sets port to 3000.');
    tracker.afterGenerate(turn2Result);

    const trace = tracker.getTrace();
    expect(trace.totalCalls).toBe(1);
    expect(trace.calls[0]?.toolName).toBe('read_file');
    expect(trace.calls[0]?.args).toEqual({ path: 'config.json' });
    expect(trace.calls[0]?.result).toEqual({ type: 'success', content: '{"port":3000}' });
    expect(trace.calls[0]?.sequenceIndex).toBe(0);
    expect(trace.calls[0]?.unknownTool).toBe(false);
    expect(trace.calls[0]?.source).toEqual({ type: 'local' });
  });

  it('tracks multiple tool calls across three turns', () => {
    const tracker = new Tracker();

    // Turn 1: model calls read_file
    tracker.beforeGenerate(
      makeCallOptions([{ role: 'user', content: [{ type: 'text', text: 'Fix the bug' }] }])
    );
    tracker.afterGenerate(
      toolCallResult([
        {
          type: 'tool-call',
          toolCallId: 'tc1',
          toolName: 'read_file',
          input: '{"path":"src/app.ts"}',
        },
      ])
    );

    // Turn 2: read_file result → model calls edit_file
    tracker.beforeGenerate(
      makeCallOptions([
        { role: 'user', content: [{ type: 'text', text: 'Fix the bug' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'tc1',
              toolName: 'read_file',
              input: { path: 'src/app.ts' },
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
      ])
    );
    tracker.afterGenerate(
      toolCallResult([
        {
          type: 'tool-call',
          toolCallId: 'tc2',
          toolName: 'edit_file',
          input: '{"path":"src/app.ts","content":"const x = 2;"}',
        },
      ])
    );

    // Turn 3: edit_file result → model responds with text
    tracker.beforeGenerate(
      makeCallOptions([
        { role: 'user', content: [{ type: 'text', text: 'Fix the bug' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'tc1',
              toolName: 'read_file',
              input: { path: 'src/app.ts' },
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
              input: { path: 'src/app.ts', content: 'const x = 2;' },
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
      ])
    );
    tracker.afterGenerate(textResult('Fixed the bug — updated x to 2.'));

    const trace = tracker.getTrace();
    expect(trace.totalCalls).toBe(2);
    expect(trace.calls.map((c) => c.toolName)).toEqual(['read_file', 'edit_file']);
    expect(trace.calls[1]?.args).toEqual({ path: 'src/app.ts', content: 'const x = 2;' });
  });

  it('captures text output from terminal response', () => {
    const tracker = new Tracker();

    tracker.beforeGenerate(
      makeCallOptions([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }])
    );
    tracker.afterGenerate(textResult('Hello there!'));

    const result = tracker.getResult();
    expect(result.output).toBe('Hello there!');
    expect(result.trace.totalCalls).toBe(0);
  });

  it('accumulates usage across turns', () => {
    const tracker = new Tracker();

    tracker.beforeGenerate(
      makeCallOptions([{ role: 'user', content: [{ type: 'text', text: 'go' }] }])
    );
    tracker.afterGenerate(
      toolCallResult([
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'bash', input: '{"cmd":"ls"}' },
      ])
    );

    tracker.beforeGenerate(
      makeCallOptions([
        { role: 'user', content: [{ type: 'text', text: 'go' }] },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'tc1', toolName: 'bash', input: { cmd: 'ls' } },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'tc1',
              toolName: 'bash',
              output: { type: 'text', value: 'file.txt' },
            },
          ],
        },
      ])
    );
    tracker.afterGenerate(textResult('Done', makeUsage(20, 15)));

    const usage = tracker.getUsage();
    expect(usage.inputTokens).toBe(30); // 10 + 20
    expect(usage.outputTokens).toBe(20); // 5 + 15
  });

  it('handles error tool results', () => {
    const tracker = new Tracker();

    tracker.beforeGenerate(
      makeCallOptions([{ role: 'user', content: [{ type: 'text', text: 'do it' }] }])
    );
    tracker.afterGenerate(
      toolCallResult([
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'bash', input: '{"cmd":"rm -rf /"}' },
      ])
    );

    tracker.beforeGenerate(
      makeCallOptions([
        { role: 'user', content: [{ type: 'text', text: 'do it' }] },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'tc1', toolName: 'bash', input: { cmd: 'rm -rf /' } },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'tc1',
              toolName: 'bash',
              output: { type: 'error-text', value: 'permission denied' },
            },
          ],
        },
      ])
    );
    tracker.afterGenerate(textResult('Command failed.'));

    const trace = tracker.getTrace();
    expect(trace.calls[0]?.result).toEqual({ type: 'error', message: 'permission denied' });
  });

  it('ignores tool results for unknown toolCallIds', () => {
    const tracker = new Tracker();

    // A tool result arrives that was never pending (from a prior conversation context)
    tracker.beforeGenerate(
      makeCallOptions([
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'unknown-id',
              toolName: 'bash',
              output: { type: 'text', value: 'ok' },
            },
          ],
        },
      ])
    );
    tracker.afterGenerate(textResult('Done'));

    expect(tracker.getTrace().totalCalls).toBe(0);
  });

  it('parses invalid JSON input gracefully', () => {
    const tracker = new Tracker();

    tracker.beforeGenerate(
      makeCallOptions([{ role: 'user', content: [{ type: 'text', text: 'go' }] }])
    );
    tracker.afterGenerate(
      toolCallResult([
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'bash', input: 'not-json' },
      ])
    );

    tracker.beforeGenerate(
      makeCallOptions([
        { role: 'user', content: [{ type: 'text', text: 'go' }] },
        {
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: 'tc1', toolName: 'bash', input: {} }],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'tc1',
              toolName: 'bash',
              output: { type: 'text', value: 'ok' },
            },
          ],
        },
      ])
    );
    tracker.afterGenerate(textResult('Done'));

    const trace = tracker.getTrace();
    expect(trace.calls[0]?.args).toEqual({});
  });
});
