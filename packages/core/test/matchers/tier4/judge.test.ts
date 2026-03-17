import { describe, expect, it } from 'vitest';
import type { AgentDriver, RunInput, RunResult } from '../../../src/driver/types.js';
import { JudgeExecutor, buildJudgePrompt } from '../../../src/matchers/tier4/judge.js';

function createMockDriver(responses: string[]): AgentDriver {
  let callIndex = 0;
  return {
    name: 'mock-judge',
    capabilities: {
      seed: false,
      parallelToolCalls: false,
      streaming: false,
      systemPromptRole: true,
      maxContextWindow: 128_000,
      contentBlockConversation: false,
    },
    async run(_input: RunInput): Promise<RunResult> {
      const output = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return {
        output,
        trace: { calls: [], totalCalls: 0, totalDurationMs: 0 },
        messages: [],
        usage: { inputTokens: 100, outputTokens: 50, model: 'mock' },
        duration: 10,
        runManifest: {} as any,
      };
    },
    async healthCheck() {
      return { ok: true, latencyMs: 1, model: 'mock' };
    },
  };
}

function jsonResponse(pass: boolean, confidence: number, justification: string): string {
  return `\`\`\`json\n${JSON.stringify({ pass, confidence, justification, reasoning: 'test reasoning' })}\n\`\`\``;
}

describe('JudgeExecutor', () => {
  it('single judge — pass', async () => {
    const driver = createMockDriver([jsonResponse(true, 0.95, 'Correct output')]);
    const executor = new JudgeExecutor(driver);
    const result = await executor.evaluate('some output', { criteria: 'Is it correct?' });

    expect(result.pass).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.justification).toBe('Correct output');
    expect(result.votes).toHaveLength(1);
  });

  it('single judge — fail', async () => {
    const driver = createMockDriver([jsonResponse(false, 0.8, 'Missing details')]);
    const executor = new JudgeExecutor(driver);
    const result = await executor.evaluate('bad output', { criteria: 'Is it correct?' });

    expect(result.pass).toBe(false);
    expect(result.justification).toBe('Missing details');
  });

  it('consensus 3 — majority pass', async () => {
    const driver = createMockDriver([
      jsonResponse(true, 0.9, 'Good'),
      jsonResponse(true, 0.85, 'Acceptable'),
      jsonResponse(false, 0.7, 'Incomplete'),
    ]);
    const executor = new JudgeExecutor(driver);
    const result = await executor.evaluate('output', {
      criteria: 'test',
      consensus: 3,
    });

    expect(result.pass).toBe(true);
    expect(result.consensus).toEqual({ passed: 2, failed: 1, total: 3 });
  });

  it('consensus 3 — majority fail', async () => {
    const driver = createMockDriver([
      jsonResponse(false, 0.8, 'Wrong'),
      jsonResponse(true, 0.6, 'Okay'),
      jsonResponse(false, 0.9, 'Incorrect'),
    ]);
    const executor = new JudgeExecutor(driver);
    const result = await executor.evaluate('output', {
      criteria: 'test',
      consensus: 3,
    });

    expect(result.pass).toBe(false);
    expect(result.consensus).toEqual({ passed: 1, failed: 2, total: 3 });
  });

  it('handles malformed JSON response', async () => {
    const driver = createMockDriver(['This is just prose with no JSON.']);
    const executor = new JudgeExecutor(driver);
    await expect(executor.evaluate('output', { criteria: 'test' })).rejects.toThrow(
      'judge voter(s) failed'
    );
  });

  it('clamps confidence to [0, 1]', async () => {
    const driver = createMockDriver([
      `\`\`\`json\n${JSON.stringify({ pass: true, confidence: 1.5, justification: 'high', reasoning: 'r' })}\n\`\`\``,
    ]);
    const executor = new JudgeExecutor(driver);
    const result = await executor.evaluate('output', { criteria: 'test' });

    expect(result.confidence).toBe(1.0);
  });

  it('accumulates tokens across consensus calls', async () => {
    const driver = createMockDriver([
      jsonResponse(true, 0.9, 'a'),
      jsonResponse(true, 0.9, 'b'),
      jsonResponse(true, 0.9, 'c'),
    ]);
    const executor = new JudgeExecutor(driver);
    const result = await executor.evaluate('output', {
      criteria: 'test',
      consensus: 3,
    });

    // 3 calls × (100 input + 50 output) = 450 tokens
    expect(result.tokens).toBe(450);
  });
});

describe('buildJudgePrompt', () => {
  it('includes criteria and output', () => {
    const prompt = buildJudgePrompt('agent output here', 'Does it identify the bug?');
    expect(prompt).toContain('Does it identify the bug?');
    expect(prompt).toContain('agent output here');
    expect(prompt).toContain('```json');
  });

  it('includes calibration examples when provided', () => {
    const prompt = buildJudgePrompt('output', 'criteria', {
      name: 'test',
      examples: [
        {
          input: 'review code',
          output: 'found SQL injection',
          pass: true,
          justification: 'Correct',
        },
      ],
    });
    expect(prompt).toContain('Calibration Examples');
    expect(prompt).toContain('found SQL injection');
    expect(prompt).toContain('PASS');
  });

  it('omits calibration section when none provided', () => {
    const prompt = buildJudgePrompt('output', 'criteria');
    expect(prompt).not.toContain('Calibration Examples');
  });
});
