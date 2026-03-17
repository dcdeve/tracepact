import { describe, expect, it } from 'vitest';
import type { AgentDriver, RunInput, RunResult } from '../../../src/driver/types.js';
import { toPassJudge } from '../../../src/matchers/tier4/index.js';

function createMockDriver(response: string): AgentDriver {
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
      return {
        output: response,
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
  return `\`\`\`json\n${JSON.stringify({ pass, confidence, justification, reasoning: 'r' })}\n\`\`\``;
}

describe('toPassJudge', () => {
  it('returns pass with justification', async () => {
    const driver = createMockDriver(jsonResponse(true, 0.92, 'Output is correct'));
    const result = await toPassJudge('good output', 'Is it correct?', { driver });

    expect(result.pass).toBe(true);
    expect(result.tier).toBe(4);
    expect(result.message).toContain('PASS');
    expect(result.message).toContain('0.92');
    expect(result.message).toContain('Output is correct');
  });

  it('returns fail with diagnostic', async () => {
    const driver = createMockDriver(jsonResponse(false, 0.85, 'Missing key details'));
    const result = await toPassJudge('bad output', 'Is it correct?', { driver });

    expect(result.pass).toBe(false);
    expect(result.tier).toBe(4);
    expect(result.message).toContain('FAIL');
    expect(result.diagnostic.expected).toBe('Is it correct?');
    expect(result.diagnostic.received).toBe('Missing key details');
  });

  it('includes consensus info in suggestion when consensus > 1', async () => {
    let callCount = 0;
    const driver: AgentDriver = {
      ...createMockDriver(''),
      async run() {
        callCount++;
        const pass = callCount <= 1;
        return {
          output: jsonResponse(pass, 0.8, pass ? 'ok' : 'fail'),
          trace: { calls: [], totalCalls: 0, totalDurationMs: 0 },
          messages: [],
          usage: { inputTokens: 100, outputTokens: 50, model: 'mock' },
          duration: 10,
          runManifest: {} as any,
        };
      },
    };

    const result = await toPassJudge('output', 'criteria', { driver, consensus: 3 });
    expect(result.diagnostic.suggestion).toContain('Consensus');
  });

  it('includes tokens in diagnostic', async () => {
    const driver = createMockDriver(jsonResponse(true, 0.9, 'ok'));
    const result = await toPassJudge('output', 'criteria', { driver });

    expect(result.diagnostic.tokens).toBeGreaterThan(0);
  });

  it('works with bundled calibration set', async () => {
    const driver = createMockDriver(jsonResponse(true, 0.95, 'Found the vulnerability'));
    const result = await toPassJudge('SQL injection on line 5', 'Identifies security issues', {
      driver,
      calibration: 'code-review',
    });

    expect(result.pass).toBe(true);
  });

  it('fails gracefully without driver', async () => {
    const result = await toPassJudge('output', 'criteria');
    expect(result.pass).toBe(false);
    expect(result.message).toContain('requires a driver');
  });
});
