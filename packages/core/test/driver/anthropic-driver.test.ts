import { describe, expect, it, vi } from 'vitest';
import { AnthropicDriver } from '../../src/driver/anthropic-driver.js';
import { mockReadFile } from '../../src/sandbox/factories.js';
import { MockSandbox } from '../../src/sandbox/mock-sandbox.js';

function createMockClient(responses: any[]) {
  let callIdx = 0;
  return {
    messages: {
      create: vi.fn(async () => {
        const resp = responses[callIdx] ?? responses[responses.length - 1];
        callIdx++;
        return resp;
      }),
    },
  };
}

function textResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 10, output_tokens: 5 },
    model: 'claude-sonnet-4-20250514',
    id: 'msg_123',
  };
}

function toolUseResponse(toolName: string, input: Record<string, unknown>) {
  return {
    content: [{ type: 'tool_use', id: 'tu_1', name: toolName, input }],
    usage: { input_tokens: 20, output_tokens: 15 },
    model: 'claude-sonnet-4-20250514',
    id: 'msg_456',
  };
}

describe('AnthropicDriver', () => {
  it('returns text output from simple response', async () => {
    const driver = new AnthropicDriver({
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });
    const mockClient = createMockClient([textResponse('Hello world')]);
    driver._setClient(mockClient);

    const sandbox = new MockSandbox({});
    const result = await driver.run({
      skill: { systemPrompt: 'You are helpful.' },
      prompt: 'Say hello',
      sandbox,
    });

    expect(result.output).toBe('Hello world');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
    expect(result.usage.model).toBe('claude-sonnet-4-20250514');
  });

  it('handles tool use with sandbox execution', async () => {
    const driver = new AnthropicDriver({
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });

    const mockClient = createMockClient([
      toolUseResponse('read_file', { path: 'src/app.ts' }),
      textResponse('File contents look good.'),
    ]);
    driver._setClient(mockClient);

    const sandbox = new MockSandbox({
      read_file: mockReadFile({ 'src/app.ts': 'const x = 1;' }),
    });

    const result = await driver.run({
      skill: { systemPrompt: 'You are a code reviewer.' },
      prompt: 'Review src/app.ts',
      sandbox,
    });

    expect(result.output).toBe('File contents look good.');
    expect(result.trace.totalCalls).toBe(1);
    expect(result.trace.calls[0].toolName).toBe('read_file');
    expect(result.usage.inputTokens).toBe(30);
    expect(result.usage.outputTokens).toBe(20);
  });

  it('throws on max iterations exceeded', async () => {
    const driver = new AnthropicDriver({
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });

    // Always returns tool use — will loop
    const mockClient = createMockClient([toolUseResponse('bash', { command: 'echo loop' })]);
    driver._setClient(mockClient);

    const sandbox = new MockSandbox({
      bash: async () => ({ type: 'success' as const, content: 'ok' }),
    });

    await expect(
      driver.run({
        skill: { systemPrompt: 'Loop forever' },
        prompt: 'go',
        sandbox,
        config: { maxToolIterations: 2 },
      })
    ).rejects.toThrow('max tool iterations');
  });

  it('performs health check', async () => {
    const driver = new AnthropicDriver({
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });

    const mockClient = createMockClient([textResponse('pong')]);
    driver._setClient(mockClient);

    const result = await driver.healthCheck();
    expect(result.ok).toBe(true);
    expect(result.model).toBe('claude-sonnet-4-20250514');
  });

  it('reports capabilities correctly', () => {
    const driver = new AnthropicDriver({
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });
    expect(driver.capabilities.seed).toBe(false);
    expect(driver.capabilities.streaming).toBe(true);
    expect(driver.capabilities.maxContextWindow).toBe(200_000);
    expect(driver.name).toBe('anthropic');
  });

  it('throws without API key', () => {
    const origKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = '';
    try {
      expect(() => new AnthropicDriver({ model: 'claude-sonnet-4-20250514' })).toThrow(
        'ANTHROPIC_API_KEY'
      );
    } finally {
      if (origKey) process.env.ANTHROPIC_API_KEY = origKey;
      else process.env.ANTHROPIC_API_KEY = '';
    }
  });
});
