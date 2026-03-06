import { describe, expect, it, vi } from 'vitest';
import { OpenAIDriver } from '../../src/driver/openai-driver.js';
import { MockSandbox } from '../../src/sandbox/mock-sandbox.js';

function createStreamingMockClient(chunks: any[]) {
  return {
    chat: {
      completions: {
        create: vi.fn(async (params: any) => {
          if (params.stream) {
            return (async function* () {
              for (const chunk of chunks) {
                yield chunk;
              }
            })();
          }
          // Non-streaming fallback
          return {
            choices: [{ message: { content: 'non-stream', tool_calls: null } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          };
        }),
      },
    },
  };
}

describe('OpenAIDriver streaming', () => {
  it('collects streamed text chunks', async () => {
    const driver = new OpenAIDriver({ model: 'gpt-4o', apiKey: 'test-key' });

    const chunks = [
      { choices: [{ delta: { content: 'Hello' } }] },
      { choices: [{ delta: { content: ' world' } }] },
      { choices: [{ delta: {} }], usage: { prompt_tokens: 15, completion_tokens: 8 } },
    ];

    const mockClient = createStreamingMockClient(chunks);
    driver._setClient(mockClient);

    const sandbox = new MockSandbox({});
    const collected: string[] = [];

    const result = await driver.run({
      skill: { systemPrompt: 'test' },
      prompt: 'hi',
      sandbox,
      config: { stream: true, onChunk: (c) => collected.push(c) },
    });

    expect(result.output).toBe('Hello world');
    expect(collected).toEqual(['Hello', ' world']);
    expect(result.usage.inputTokens).toBe(15);
    expect(result.usage.outputTokens).toBe(8);
  });

  it('handles streamed tool calls', async () => {
    const driver = new OpenAIDriver({ model: 'gpt-4o', apiKey: 'test-key' });

    // First stream: tool call
    const toolChunks = [
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'tc_1',
                  function: { name: 'read_file', arguments: '{"pat' },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: { arguments: 'h":"a.ts"}' },
                },
              ],
            },
          },
        ],
      },
      { choices: [{ delta: {} }], usage: { prompt_tokens: 20, completion_tokens: 10 } },
    ];

    // Second call (non-streaming, final text response)
    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn(async (params: any) => {
            callCount++;
            if (callCount === 1 && params.stream) {
              return (async function* () {
                for (const chunk of toolChunks) yield chunk;
              })();
            }
            // Second call: final text
            if (params.stream) {
              return (async function* () {
                yield { choices: [{ delta: { content: 'Done!' } }] };
                yield {
                  choices: [{ delta: {} }],
                  usage: { prompt_tokens: 30, completion_tokens: 5 },
                };
              })();
            }
            return {
              choices: [{ message: { content: 'Done!', tool_calls: null } }],
              usage: { prompt_tokens: 30, completion_tokens: 5 },
            };
          }),
        },
      },
    };

    driver._setClient(mockClient);

    const sandbox = new MockSandbox({
      read_file: async () => ({ type: 'success' as const, content: 'file contents' }),
    });

    const result = await driver.run({
      skill: { systemPrompt: 'test' },
      prompt: 'read a.ts',
      sandbox,
      config: { stream: true },
    });

    expect(result.output).toBe('Done!');
    expect(result.trace.totalCalls).toBe(1);
    expect(result.trace.calls[0].toolName).toBe('read_file');
  });
});
