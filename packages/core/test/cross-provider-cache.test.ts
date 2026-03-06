import { describe, expect, it } from 'vitest';
import { computeManifest, manifestHash } from '../src/cache/run-manifest.js';

const baseParams = {
  skill: { systemPrompt: 'You are a code reviewer.' },
  prompt: 'Review this file',
  provider: 'claude',
  model: 'claude-sonnet-4-5-20250929',
  temperature: 0,
  frameworkVersion: '0.0.1',
  driverVersion: '0.0.1',
};

describe('Cross-provider cache', () => {
  it('same prompt + different provider = different cache key', () => {
    const claude = computeManifest(baseParams);
    const openai = computeManifest({
      ...baseParams,
      provider: 'openai',
      model: 'gpt-4o',
    });

    expect(manifestHash(claude)).not.toBe(manifestHash(openai));
  });

  it('same prompt + same provider = same cache key', () => {
    const m1 = computeManifest(baseParams);
    const m2 = computeManifest(baseParams);

    expect(manifestHash(m1)).toBe(manifestHash(m2));
  });

  it('manifest.provider correctly set for each driver', () => {
    const claude = computeManifest(baseParams);
    const openai = computeManifest({
      ...baseParams,
      provider: 'openai',
      model: 'gpt-4o',
    });

    expect(claude.provider).toBe('claude');
    expect(openai.provider).toBe('openai');
  });
});
