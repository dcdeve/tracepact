import { describe, expect, it } from 'vitest';
import { computeManifest, manifestHash } from '../src/cache/run-manifest.js';

const baseParams = {
  skill: { systemPrompt: 'You are a helper.' },
  prompt: 'Do something',
  provider: 'claude',
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
  frameworkVersion: '0.0.1',
  driverVersion: '0.0.1',
};

describe('RunManifest', () => {
  it('computes manifest from systemPrompt', () => {
    const manifest = computeManifest(baseParams);
    expect(manifest.skillHash).toHaveLength(64);
    expect(manifest.promptHash).toHaveLength(64);
    expect(manifest.toolDefsHash).toHaveLength(64);
    expect(manifest.provider).toBe('claude');
    expect(manifest.model).toBe('claude-sonnet-4-20250514');
  });

  it('produces consistent hash for same inputs', () => {
    const m1 = computeManifest(baseParams);
    const m2 = computeManifest(baseParams);
    expect(manifestHash(m1)).toBe(manifestHash(m2));
  });

  it('produces different hash when prompt changes', () => {
    const m1 = computeManifest(baseParams);
    const m2 = computeManifest({ ...baseParams, prompt: 'Different prompt' });
    expect(manifestHash(m1)).not.toBe(manifestHash(m2));
  });

  it('produces different hash when model changes', () => {
    const m1 = computeManifest(baseParams);
    const m2 = computeManifest({ ...baseParams, model: 'claude-opus-4-20250514' });
    expect(manifestHash(m1)).not.toBe(manifestHash(m2));
  });

  it('produces different hash when temperature changes', () => {
    const m1 = computeManifest(baseParams);
    const m2 = computeManifest({ ...baseParams, temperature: 0.5 });
    expect(manifestHash(m1)).not.toBe(manifestHash(m2));
  });

  it('uses ParsedSkill hash when available', () => {
    const m1 = computeManifest({
      ...baseParams,
      skill: { hash: 'abc123'.repeat(11).slice(0, 64) } as any,
    });
    expect(m1.skillHash).toBe('abc123'.repeat(11).slice(0, 64));
  });
});
