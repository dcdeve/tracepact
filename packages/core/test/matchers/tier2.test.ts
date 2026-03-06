import { describe, expect, it } from 'vitest';
import {
  toContain,
  toContainAll,
  toContainAny,
  toMention,
  toNotContain,
} from '../../src/matchers/tier2/index.js';

describe('toContain', () => {
  it('passes when string literal found', () => {
    expect(toContain('Hello world', 'world').pass).toBe(true);
  });

  it('fails when string literal missing', () => {
    const r = toContain('Hello world', 'planet');
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('Output preview');
  });

  it('passes when regex matches', () => {
    expect(toContain('Error code: 404', /\d{3}/).pass).toBe(true);
  });

  it('fails when regex does not match', () => {
    const r = toContain('Hello world', /\d+/);
    expect(r.pass).toBe(false);
  });
});

describe('toMention', () => {
  it('passes case-insensitive', () => {
    expect(toMention('The TypeScript language', 'typescript').pass).toBe(true);
  });

  it('fails when term not found', () => {
    const r = toMention('Hello world', 'python');
    expect(r.pass).toBe(false);
  });

  it('passes with stemmed match: "parameterized" matches "parameterize"', () => {
    expect(toMention('The function is parameterized', 'parameterize', { stem: true }).pass).toBe(
      true
    );
  });

  it('passes with stemmed match: "running" matches "run"', () => {
    expect(toMention('The process is running', 'run', { stem: true }).pass).toBe(true);
  });

  it('fails stemmed when no match', () => {
    const r = toMention('Hello world', 'typescript', { stem: true });
    expect(r.pass).toBe(false);
  });
});

describe('toNotContain', () => {
  it('passes when pattern absent', () => {
    expect(toNotContain('Hello world', 'secret').pass).toBe(true);
  });

  it('fails when pattern present', () => {
    const r = toNotContain('Contains secret data', 'secret');
    expect(r.pass).toBe(false);
  });
});

describe('toContainAll', () => {
  it('passes when all patterns match', () => {
    expect(toContainAll('Hello world foo bar', ['Hello', 'world', 'foo']).pass).toBe(true);
  });

  it('fails when one pattern missing', () => {
    const r = toContainAll('Hello world', ['Hello', 'missing']);
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('missing');
  });
});

describe('toContainAny', () => {
  it('passes when at least one matches', () => {
    expect(toContainAny('Hello world', ['planet', 'world']).pass).toBe(true);
  });

  it('fails when none match', () => {
    const r = toContainAny('Hello world', ['planet', 'galaxy']);
    expect(r.pass).toBe(false);
    expect(r.diagnostic.suggestion).toContain('None of the');
  });
});
