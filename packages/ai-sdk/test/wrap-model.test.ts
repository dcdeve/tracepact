import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { describe, expect, it, vi } from 'vitest';
import { wrapModel } from '../src/wrap-model.js';

// ---------- helpers ----------

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

// ---------- tests ----------

describe('wrapModel', () => {
  it('returns a LanguageModelV3 with correct metadata', () => {
    const inner = createMockModel([textResponse('hi')]);
    const { model } = wrapModel(inner);

    expect(model.specificationVersion).toBe('v3');
    expect(model.provider).toBe('test-provider');
    expect(model.modelId).toBe('test-model');
  });

  it('delegates doGenerate to the inner model', async () => {
    const inner = createMockModel([textResponse('Hello!')]);
    const { model } = wrapModel(inner);

    const options: LanguageModelV3CallOptions = {
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    const result = await model.doGenerate(options);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Hello!' });
    expect(inner.doGenerate).toHaveBeenCalledOnce();
  });

  it('tracks a simple text response', async () => {
    const inner = createMockModel([textResponse('All done.')]);
    const { model, getTrace, getResult } = wrapModel(inner);

    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Do it' }] }],
    });

    expect(getTrace().totalCalls).toBe(0);
    expect(getResult().output).toBe('All done.');
  });

  it('tracks tool calls across a multi-turn agent loop', async () => {
    const inner = createMockModel([
      toolCallResponse([{ id: 'tc1', name: 'read_file', input: { path: 'app.ts' } }]),
      toolCallResponse([
        { id: 'tc2', name: 'edit_file', input: { path: 'app.ts', content: 'fixed' } },
      ]),
      textResponse('Bug fixed.'),
    ]);

    const { model, getTrace, getResult } = wrapModel(inner);

    // Turn 1: user prompt → model calls read_file
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Fix the bug' }] }],
    });

    // Turn 2: tool result → model calls edit_file
    await model.doGenerate({
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
    });

    // Turn 3: tool result → model responds with text
    await model.doGenerate({
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
              input: { path: 'app.ts', content: 'fixed' },
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
    });

    const trace = getTrace();
    expect(trace.totalCalls).toBe(2);
    expect(trace.calls.map((c) => c.toolName)).toEqual(['read_file', 'edit_file']);
    expect(trace.calls[0]?.result).toEqual({ type: 'success', content: 'const x = 1;' });
    expect(trace.calls[1]?.result).toEqual({ type: 'success', content: 'ok' });

    const result = getResult();
    expect(result.output).toBe('Bug fixed.');
  });

  it('delegates doStream to the inner model', async () => {
    const inner = createMockModel([]);
    const streamResult = {
      stream: new ReadableStream(),
    };
    (inner.doStream as ReturnType<typeof vi.fn>).mockResolvedValue(streamResult);

    const { model } = wrapModel(inner);
    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    });

    expect(result).toBe(streamResult);
  });
});
