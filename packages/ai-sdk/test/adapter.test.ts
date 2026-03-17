import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import {
  contentToAssistantMessage,
  isErrorOutput,
  promptToMessages,
  toUsageInfo,
  toolResultOutputToString,
} from '../src/adapter.js';

describe('promptToMessages', () => {
  it('converts a system message', () => {
    const prompt: LanguageModelV3Prompt = [{ role: 'system', content: 'You are helpful.' }];

    expect(promptToMessages(prompt)).toEqual([{ role: 'system', content: 'You are helpful.' }]);
  });

  it('converts a user message with text parts', () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
      },
    ];

    expect(promptToMessages(prompt)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
      },
    ]);
  });

  it('skips file parts in user messages', () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image' },
          { type: 'file', data: 'base64data', mediaType: 'image/png' },
        ],
      },
    ];

    expect(promptToMessages(prompt)).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Describe this image' }],
      },
    ]);
  });

  it('converts an assistant message with text and tool_use', () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me read the file.' },
          {
            type: 'tool-call',
            toolCallId: 'tc1',
            toolName: 'read_file',
            input: { path: 'foo.ts' },
          },
        ],
      },
    ];

    expect(promptToMessages(prompt)).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me read the file.' },
          { type: 'tool_use', id: 'tc1', name: 'read_file', input: { path: 'foo.ts' } },
        ],
      },
    ]);
  });

  it('converts tool role to user with tool_result blocks', () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            toolName: 'read_file',
            output: { type: 'text', value: 'file contents here' },
          },
        ],
      },
    ];

    expect(promptToMessages(prompt)).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tc1',
            content: 'file contents here',
            is_error: false,
          },
        ],
      },
    ]);
  });

  it('marks error tool results with is_error', () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            toolName: 'bash',
            output: { type: 'error-text', value: 'command not found' },
          },
        ],
      },
    ];

    const messages = promptToMessages(prompt);
    const blocks = messages[0]?.content as Array<{ type: string; is_error?: boolean }>;
    expect(blocks[0]?.is_error).toBe(true);
  });

  it('converts a full multi-turn conversation', () => {
    const prompt: LanguageModelV3Prompt = [
      { role: 'system', content: 'You are an agent.' },
      { role: 'user', content: [{ type: 'text', text: 'Deploy the app' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc1',
            toolName: 'bash',
            input: { cmd: 'npm run build' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            toolName: 'bash',
            output: { type: 'text', value: 'Build succeeded' },
          },
        ],
      },
    ];

    const messages = promptToMessages(prompt);
    expect(messages).toHaveLength(4);
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.role).toBe('user');
    expect(messages[2]?.role).toBe('assistant');
    expect(messages[3]?.role).toBe('user'); // tool → user
  });
});

describe('contentToAssistantMessage', () => {
  it('creates a text-only assistant message as string', () => {
    const msg = contentToAssistantMessage([{ type: 'text', text: 'Done!' }]);
    expect(msg).toEqual({ role: 'assistant', content: 'Done!' });
  });

  it('creates an assistant message with tool calls', () => {
    const msg = contentToAssistantMessage([
      { type: 'tool-call', toolCallId: 'tc1', toolName: 'bash', input: '{"cmd":"ls"}' },
    ]);

    expect(msg).toEqual({
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'tc1', name: 'bash', input: { cmd: 'ls' } }],
    });
  });

  it('creates an assistant message with mixed text and tool calls', () => {
    const msg = contentToAssistantMessage([
      { type: 'text', text: 'Running command...' },
      { type: 'tool-call', toolCallId: 'tc1', toolName: 'bash', input: '{"cmd":"ls"}' },
    ]);

    expect(msg).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Running command...' },
        { type: 'tool_use', id: 'tc1', name: 'bash', input: { cmd: 'ls' } },
      ],
    });
  });
});

describe('toUsageInfo', () => {
  it('maps usage and modelId', () => {
    expect(
      toUsageInfo({ inputTokens: 100, outputTokens: 50 }, 'claude-3-5-sonnet-20241022')
    ).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      model: 'claude-3-5-sonnet-20241022',
    });
  });
});

describe('toolResultOutputToString', () => {
  it('serializes text', () => {
    expect(toolResultOutputToString({ type: 'text', value: 'hello' })).toBe('hello');
  });

  it('serializes json', () => {
    expect(toolResultOutputToString({ type: 'json', value: [1, 2] })).toBe('[1,2]');
  });

  it('serializes content — text parts only', () => {
    expect(
      toolResultOutputToString({
        type: 'content',
        value: [
          { type: 'text', text: 'a' },
          { type: 'image-url', url: 'https://example.com/x.png' },
          { type: 'text', text: 'b' },
        ],
      })
    ).toBe('ab');
  });
});

describe('isErrorOutput', () => {
  it('returns true for error-text', () => {
    expect(isErrorOutput({ type: 'error-text', value: 'fail' })).toBe(true);
  });

  it('returns true for error-json', () => {
    expect(isErrorOutput({ type: 'error-json', value: {} })).toBe(true);
  });

  it('returns true for execution-denied', () => {
    expect(isErrorOutput({ type: 'execution-denied' })).toBe(true);
  });

  it('returns false for text', () => {
    expect(isErrorOutput({ type: 'text', value: 'ok' })).toBe(false);
  });

  it('returns false for json', () => {
    expect(isErrorOutput({ type: 'json', value: {} })).toBe(false);
  });
});
