import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TracepactProvider } from '../src/provider.js';

// Mock @tracepact/core to avoid real driver/parser
vi.mock('@tracepact/core', async () => {
  const actual = await vi.importActual<typeof import('@tracepact/core')>('@tracepact/core');
  return {
    ...actual,
    parseSkill: vi.fn(),
    resolveConfig: vi.fn(() => ({})),
    DriverRegistry: vi.fn(),
  };
});

import { DriverRegistry, parseSkill } from '@tracepact/core';

const mockParseSkill = vi.mocked(parseSkill);
const MockDriverRegistry = vi.mocked(DriverRegistry);

function makeRunResult(overrides: Record<string, unknown> = {}) {
  return {
    output: 'test output',
    trace: { calls: [], totalDurationMs: 0 },
    messages: [],
    usage: { inputTokens: 100, outputTokens: 50, model: 'gpt-4o' },
    duration: 123,
    runManifest: { provider: 'openai', model: 'gpt-4o' },
    ...overrides,
  };
}

describe('TracepactProvider', () => {
  let mockDriverInstance: {
    name: string;
    capabilities: object;
    run: ReturnType<typeof vi.fn>;
    healthCheck: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDriverInstance = {
      name: 'openai',
      capabilities: {},
      run: vi.fn(async () => makeRunResult()),
      healthCheck: vi.fn(),
    };
    // Default: DriverRegistry constructor returns registry with get() returning mock driver
    MockDriverRegistry.mockImplementation((() => ({
      get: vi.fn(() => mockDriverInstance),
    })) as any);
  });

  it('returns output and trace metadata with SKILL.md', async () => {
    mockParseSkill.mockResolvedValue({
      frontmatter: { name: 'test-skill' },
      body: 'You are a test agent.',
      hash: 'abc123',
      parseWarnings: [],
      filePath: '/tmp/SKILL.md',
    });

    const provider = new TracepactProvider({
      skill: '/tmp/SKILL.md',
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-key',
    });

    expect(provider.id()).toBe('tracepact:openai:gpt-4o');

    const result = await provider.callApi('Review this code');

    expect(mockParseSkill).toHaveBeenCalledWith('/tmp/SKILL.md');
    expect(result.output).toBe('test output');
    expect(result.tokenUsage).toEqual({ prompt: 100, completion: 50, total: 150 });
    expect(result.metadata?.trace).toEqual({ calls: [], totalDurationMs: 0 });
    expect(result.metadata?.duration).toBe(123);
    expect(result.error).toBeUndefined();
  });

  it('returns output with systemPrompt (no SKILL.md)', async () => {
    const provider = new TracepactProvider({
      systemPrompt: 'You review code for security issues.',
      apiKey: 'test-key',
    });

    expect(provider.id()).toBe('tracepact:openai:default');

    const result = await provider.callApi('Check this function');

    expect(mockParseSkill).not.toHaveBeenCalled();
    expect(result.output).toBe('test output');
    expect(result.error).toBeUndefined();

    // Verify systemPrompt was passed to driver.run
    expect(mockDriverInstance.run).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: { systemPrompt: 'You review code for security issues.' },
        prompt: 'Check this function',
      })
    );
  });

  it('builds mock sandbox from tool config', async () => {
    const provider = new TracepactProvider({
      systemPrompt: 'Agent.',
      apiKey: 'test-key',
      tools: {
        read_file: { type: 'readFile', files: { 'a.txt': 'hello' } },
        write_file: { type: 'deny' },
        bash: { type: 'passthrough' },
      },
    });

    await provider.callApi('Do something');

    const runCall = mockDriverInstance.run.mock.calls[0]?.[0];
    const sandbox = runCall?.sandbox;

    // Verify sandbox has the mocked tools by executing them
    const readResult = await sandbox.executeTool('read_file', { path: 'a.txt' });
    expect(readResult.type).toBe('success');
    expect(readResult.content).toContain('hello');

    const denyResult = await sandbox.executeTool('write_file', { path: 'x', content: 'y' });
    expect(denyResult.type).toBe('error');
  });

  it('returns error when neither skill nor systemPrompt is set', async () => {
    const provider = new TracepactProvider({
      apiKey: 'test-key',
    });

    const result = await provider.callApi('Hello');

    expect(result.error).toContain('skill');
    expect(result.error).toContain('systemPrompt');
    expect(result.output).toBeUndefined();
  });

  it('returns error when driver throws', async () => {
    mockDriverInstance.run.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const provider = new TracepactProvider({
      systemPrompt: 'Test.',
      apiKey: 'test-key',
    });

    const result = await provider.callApi('Go');

    expect(result.error).toBe('API rate limit exceeded');
    expect(result.output).toBeUndefined();
  });
});
