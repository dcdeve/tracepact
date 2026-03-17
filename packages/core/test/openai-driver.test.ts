import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAIDriver } from '../src/driver/openai-driver.js';
import { DriverError } from '../src/errors/driver-error.js';
import { setLogLevel } from '../src/logger.js';
import { MockSandbox } from '../src/sandbox/mock-sandbox.js';

// Helper: create a mock OpenAI client
function mockClient(responses: any[]) {
  let callIndex = 0;
  return {
    chat: {
      completions: {
        create: vi.fn(async () => {
          const resp = responses[callIndex];
          if (!resp) throw new Error('No more mock responses');
          callIndex++;
          return resp;
        }),
      },
    },
  };
}

// Helper: build a simple text response
function textResponse(content: string, usage = { prompt_tokens: 10, completion_tokens: 5 }) {
  return {
    model: 'gpt-4o',
    system_fingerprint: 'fp_abc123',
    usage,
    choices: [
      {
        message: { role: 'assistant', content, tool_calls: null },
        finish_reason: 'stop',
      },
    ],
  };
}

// Helper: build a tool-call response
function toolCallResponse(
  calls: Array<{ id: string; name: string; args: string }>,
  usage = { prompt_tokens: 10, completion_tokens: 5 }
) {
  return {
    model: 'gpt-4o',
    system_fingerprint: 'fp_abc123',
    usage,
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: c.args },
          })),
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

function createDriver(): OpenAIDriver {
  const driver = new OpenAIDriver({
    model: 'gpt-4o',
    apiKey: 'test-key',
    retry: { maxAttempts: 1 },
  });
  return driver;
}

describe('OpenAIDriver', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    setLogLevel('error'); // suppress warnings in tests
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      // biome-ignore lint/performance/noDelete: process.env requires delete
      delete process.env.OPENAI_API_KEY;
    }
  });

  describe('constructor', () => {
    it('creates with explicit apiKey', () => {
      const driver = new OpenAIDriver({ model: 'gpt-4o', apiKey: 'sk-test' });
      expect(driver.name).toBe('openai');
      expect(driver.capabilities.seed).toBe(true);
    });

    it('creates with env OPENAI_API_KEY', () => {
      process.env.OPENAI_API_KEY = 'sk-env';
      const driver = new OpenAIDriver({ model: 'gpt-4o' });
      expect(driver.name).toBe('openai');
    });

    it('throws DriverError without API key', () => {
      // biome-ignore lint/performance/noDelete: process.env requires delete
      delete process.env.OPENAI_API_KEY;
      expect(() => new OpenAIDriver({ model: 'gpt-4o' })).toThrow(DriverError);
      expect(() => new OpenAIDriver({ model: 'gpt-4o' })).toThrow('OPENAI_API_KEY');
    });

    it('accepts baseURL for custom providers', () => {
      const driver = new OpenAIDriver({
        model: 'llama-3.3-70b',
        apiKey: 'sk-groq',
        baseURL: 'https://api.groq.com/openai/v1',
        providerName: 'groq',
      });
      expect(driver.name).toBe('groq');
    });

    it('uses custom providerName', () => {
      const driver = new OpenAIDriver({
        model: 'custom-model',
        apiKey: 'sk-test',
        providerName: 'my-provider',
      });
      expect(driver.name).toBe('my-provider');
    });

    it('defaults providerName to openai', () => {
      const driver = new OpenAIDriver({ model: 'gpt-4o', apiKey: 'sk-test' });
      expect(driver.name).toBe('openai');
    });

    it('includes providerName in error message when set', () => {
      // biome-ignore lint/performance/noDelete: process.env requires delete
      delete process.env.OPENAI_API_KEY;
      expect(() => new OpenAIDriver({ model: 'x', providerName: 'groq' })).toThrow('groq');
    });
  });

  describe('healthCheck', () => {
    it('returns ok on success', async () => {
      const driver = createDriver();
      const client = mockClient([textResponse('pong')]);
      driver._setClient(client);

      const result = await driver.healthCheck();
      expect(result.ok).toBe(true);
      expect(result.model).toBe('gpt-4o');
      expect(result.modelVersion).toBe('fp_abc123');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns error on failure', async () => {
      const driver = createDriver();
      driver._setClient({
        chat: {
          completions: {
            create: vi.fn(async () => {
              throw new Error('network error');
            }),
          },
        },
      });

      const result = await driver.healthCheck();
      expect(result.ok).toBe(false);
      expect(result.error).toBe('network error');
    });
  });

  describe('run', () => {
    it('handles simple prompt without tools', async () => {
      const driver = createDriver();
      const client = mockClient([textResponse('Hello world')]);
      driver._setClient(client);

      const sandbox = new MockSandbox({});
      const result = await driver.run({
        skill: { systemPrompt: 'You are helpful.' },
        prompt: 'Say hello',
        sandbox,
      });

      expect(result.output).toBe('Hello world');
      expect(result.trace.calls).toHaveLength(0);
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(result.usage.model).toBe('gpt-4o');
      expect(result.runManifest.provider).toBe('openai');
    });

    it('handles single tool call', async () => {
      const driver = createDriver();
      const client = mockClient([
        toolCallResponse([{ id: 'call_1', name: 'read_file', args: '{"path":"a.txt"}' }]),
        textResponse('File contents: hello'),
      ]);
      driver._setClient(client);

      const sandbox = new MockSandbox({
        read_file: async (args) => ({ type: 'success', content: `contents of ${args.path}` }),
      });

      const result = await driver.run({
        skill: { systemPrompt: 'You read files.' },
        prompt: 'Read a.txt',
        tools: [
          {
            name: 'read_file',
            jsonSchema: { type: 'object', properties: { path: { type: 'string' } } },
          },
        ],
        sandbox,
      });

      expect(result.output).toBe('File contents: hello');
      expect(result.trace.calls).toHaveLength(1);
      expect(result.trace.calls[0].toolName).toBe('read_file');
      expect(result.trace.calls[0].args).toEqual({ path: 'a.txt' });
    });

    it('handles multi-step tool calls', async () => {
      const driver = createDriver();
      const client = mockClient([
        toolCallResponse([{ id: 'call_1', name: 'read_file', args: '{"path":"a.txt"}' }]),
        toolCallResponse([
          { id: 'call_2', name: 'write_file', args: '{"path":"b.txt","content":"done"}' },
        ]),
        textResponse('Done writing'),
      ]);
      driver._setClient(client);

      const sandbox = new MockSandbox({
        read_file: async () => ({ type: 'success', content: 'data' }),
        write_file: async () => ({ type: 'success', content: 'ok' }),
      });

      const result = await driver.run({
        skill: { systemPrompt: 'You process files.' },
        prompt: 'Copy a to b',
        tools: [
          { name: 'read_file', jsonSchema: {} },
          { name: 'write_file', jsonSchema: {} },
        ],
        sandbox,
      });

      expect(result.output).toBe('Done writing');
      expect(result.trace.calls).toHaveLength(2);
      expect(result.trace.calls[0].toolName).toBe('read_file');
      expect(result.trace.calls[1].toolName).toBe('write_file');
    });

    it('handles parallel tool calls', async () => {
      const driver = createDriver();
      const client = mockClient([
        toolCallResponse([
          { id: 'call_1', name: 'read_file', args: '{"path":"a.txt"}' },
          { id: 'call_2', name: 'read_file', args: '{"path":"b.txt"}' },
        ]),
        textResponse('Both read'),
      ]);
      driver._setClient(client);

      const sandbox = new MockSandbox({
        read_file: async (args) => ({ type: 'success', content: `content of ${args.path}` }),
      });

      const result = await driver.run({
        skill: { systemPrompt: 'Reader.' },
        prompt: 'Read both',
        tools: [{ name: 'read_file', jsonSchema: {} }],
        sandbox,
      });

      expect(result.output).toBe('Both read');
      expect(result.trace.calls).toHaveLength(2);

      // Verify both tool_call_id messages were sent back
      const createCall = client.chat.completions.create;
      expect(createCall).toHaveBeenCalledTimes(2);
    });

    it('handles malformed JSON in tool args', async () => {
      const driver = createDriver();
      setLogLevel('error'); // suppress the warn
      const client = mockClient([
        toolCallResponse([{ id: 'call_1', name: 'read_file', args: '{bad json' }]),
        textResponse('Recovered'),
      ]);
      driver._setClient(client);

      const sandbox = new MockSandbox({
        read_file: async () => ({ type: 'success', content: 'ok' }),
      });

      const result = await driver.run({
        skill: { systemPrompt: 'Be nice.' },
        prompt: 'Do something',
        tools: [{ name: 'read_file', jsonSchema: {} }],
        sandbox,
      });

      expect(result.output).toBe('Recovered');
      expect(result.trace.calls[0].args).toEqual({});
    });

    it('throws on max iterations exceeded', async () => {
      const driver = createDriver();
      // Always return tool calls — never stops
      const infiniteToolCalls = Array.from({ length: 25 }, () =>
        toolCallResponse([{ id: 'call_n', name: 'read_file', args: '{}' }])
      );
      const client = mockClient(infiniteToolCalls);
      driver._setClient(client);

      const sandbox = new MockSandbox({
        read_file: async () => ({ type: 'success', content: 'ok' }),
      });

      await expect(
        driver.run({
          skill: { systemPrompt: 'Loop.' },
          prompt: 'Go',
          tools: [{ name: 'read_file', jsonSchema: {} }],
          sandbox,
          config: { maxToolIterations: 3 },
        })
      ).rejects.toThrow('max tool iterations');
    });

    it('passes seed parameter to API', async () => {
      const driver = createDriver();
      const client = mockClient([textResponse('Seeded')]);
      driver._setClient(client);

      const sandbox = new MockSandbox({});
      await driver.run({
        skill: { systemPrompt: 'Test.' },
        prompt: 'Deterministic',
        sandbox,
        config: { seed: 42 },
      });

      const createCall = client.chat.completions.create;
      expect(createCall).toHaveBeenCalledWith(
        expect.objectContaining({ seed: 42 }),
        expect.anything()
      );
    });

    it('tracks token usage across iterations', async () => {
      const driver = createDriver();
      const client = mockClient([
        toolCallResponse([{ id: 'call_1', name: 'read_file', args: '{}' }], {
          prompt_tokens: 100,
          completion_tokens: 20,
        }),
        textResponse('Done', { prompt_tokens: 150, completion_tokens: 30 }),
      ]);
      driver._setClient(client);

      const sandbox = new MockSandbox({
        read_file: async () => ({ type: 'success', content: 'ok' }),
      });

      const result = await driver.run({
        skill: { systemPrompt: 'Test.' },
        prompt: 'Go',
        tools: [{ name: 'read_file', jsonSchema: {} }],
        sandbox,
      });

      expect(result.usage.inputTokens).toBe(250);
      expect(result.usage.outputTokens).toBe(50);
    });

    it('throws on empty choices', async () => {
      const driver = createDriver();
      const client = mockClient([{ model: 'gpt-4o', usage: {}, choices: [] }]);
      driver._setClient(client);

      const sandbox = new MockSandbox({});
      await expect(
        driver.run({
          skill: { systemPrompt: 'Test.' },
          prompt: 'Go',
          sandbox,
        })
      ).rejects.toThrow('empty choices');
    });

    it('manifest uses dynamic providerName', async () => {
      const driver = new OpenAIDriver({
        model: 'llama-3.3-70b',
        apiKey: 'sk-groq',
        providerName: 'groq',
      });
      const client = mockClient([textResponse('OK')]);
      driver._setClient(client);

      const sandbox = new MockSandbox({});
      const result = await driver.run({
        skill: { systemPrompt: 'Test.' },
        prompt: 'Hello',
        sandbox,
      });

      expect(result.runManifest.provider).toBe('groq');
    });

    it('works with ParsedSkill (has hash/body)', async () => {
      const driver = createDriver();
      const client = mockClient([textResponse('OK')]);
      driver._setClient(client);

      const sandbox = new MockSandbox({});
      const result = await driver.run({
        skill: {
          hash: 'abc123',
          body: 'You are a code reviewer.',
          frontmatter: {} as any,
          raw: '',
        } as any,
        prompt: 'Review this',
        sandbox,
      });

      expect(result.output).toBe('OK');
      // Verify system message used body
      const createCall = client.chat.completions.create;
      expect(createCall).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a code reviewer.' },
          ]),
        }),
        expect.anything()
      );
    });
  });
});
