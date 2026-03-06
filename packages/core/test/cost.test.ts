import { describe, expect, it } from 'vitest';
import { TokenAccumulator } from '../src/cost/accumulator.js';

describe('TokenAccumulator', () => {
  function entry(overrides: Partial<Parameters<TokenAccumulator['add']>[0]> = {}) {
    return {
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      cached: false,
      ...overrides,
    };
  }

  it('tracks total tokens', () => {
    const acc = new TokenAccumulator();
    acc.add(entry({ inputTokens: 100, outputTokens: 50 }));
    acc.add(entry({ inputTokens: 200, outputTokens: 100 }));
    expect(acc.totalTokens).toBe(450);
  });

  it('excludes cached entries from live total', () => {
    const acc = new TokenAccumulator();
    acc.add(entry({ inputTokens: 100, outputTokens: 50, cached: false }));
    acc.add(entry({ inputTokens: 200, outputTokens: 100, cached: true }));
    expect(acc.liveTokens).toBe(150);
    expect(acc.totalTokens).toBe(450);
  });

  it('exceedsBudget checks live tokens only', () => {
    const acc = new TokenAccumulator();
    acc.add(entry({ inputTokens: 500, outputTokens: 500, cached: false }));
    acc.add(entry({ inputTokens: 500, outputTokens: 500, cached: true }));
    expect(acc.exceedsBudget(900)).toBe(true);
    expect(acc.exceedsBudget(1100)).toBe(false);
  });

  it('getReport breaks down by provider', () => {
    const acc = new TokenAccumulator();
    acc.add(entry({ inputTokens: 100, outputTokens: 50, provider: 'openai' }));
    acc.add(entry({ inputTokens: 200, outputTokens: 100, provider: 'claude' }));
    const report = acc.getReport();
    expect(report.byProvider.openai).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(report.byProvider.claude).toEqual({ inputTokens: 200, outputTokens: 100 });
  });

  it('getReport counts API calls and cache hits', () => {
    const acc = new TokenAccumulator();
    acc.add(entry({ cached: false }));
    acc.add(entry({ cached: false }));
    acc.add(entry({ cached: true }));
    const report = acc.getReport();
    expect(report.totalApiCalls).toBe(2);
    expect(report.totalCacheHits).toBe(1);
  });

  it('toJSON returns valid JSON', () => {
    const acc = new TokenAccumulator();
    acc.add(entry());
    const json = acc.toJSON();
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json).totalInputTokens).toBe(100);
    expect(JSON.parse(json).totalOutputTokens).toBe(50);
  });
});
