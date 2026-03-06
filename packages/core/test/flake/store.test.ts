import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FlakeStore } from '../../src/flake/store.js';

const TEST_DIR = join(import.meta.dirname, '__flake_test__');
const STORE_PATH = join(TEST_DIR, 'flake-history.json');

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('FlakeStore', () => {
  it('records a pass and returns correct score', () => {
    const store = new FlakeStore(STORE_PATH);
    store.record('test-1', true);
    const score = store.getScore('test-1');
    expect(score.passCount).toBe(1);
    expect(score.failCount).toBe(0);
    expect(score.isFlaky).toBe(false);
  });

  it('detects flaky test (>10% failure over ≥3 runs)', () => {
    const store = new FlakeStore(STORE_PATH);
    for (let i = 0; i < 8; i++) store.record('test-2', true);
    for (let i = 0; i < 2; i++) store.record('test-2', false);
    const score = store.getScore('test-2');
    expect(score.failureRate).toBe(0.2);
    expect(score.isFlaky).toBe(true);
  });

  it('does not flag as flaky with 10 passes', () => {
    const store = new FlakeStore(STORE_PATH);
    for (let i = 0; i < 10; i++) store.record('test-3', true);
    const score = store.getScore('test-3');
    expect(score.failureRate).toBe(0);
    expect(score.isFlaky).toBe(false);
  });

  it('trims to 10 entries per test', () => {
    const store = new FlakeStore(STORE_PATH);
    for (let i = 0; i < 15; i++) store.record('test-4', true);
    const score = store.getScore('test-4');
    expect(score.totalRuns).toBe(10);
  });

  it('saves and loads from disk', async () => {
    const store = new FlakeStore(STORE_PATH);
    store.record('test-5', true);
    store.record('test-5', false);
    await store.save();

    const loaded = new FlakeStore(STORE_PATH);
    await loaded.load();
    const score = loaded.getScore('test-5');
    expect(score.totalRuns).toBe(2);
    expect(score.passCount).toBe(1);
    expect(score.failCount).toBe(1);
  });

  it('tracks multiple tests independently', () => {
    const store = new FlakeStore(STORE_PATH);
    store.record('test-a', true);
    store.record('test-b', false);
    expect(store.getScore('test-a').passCount).toBe(1);
    expect(store.getScore('test-b').failCount).toBe(1);
    expect(store.getAllScores()).toHaveLength(2);
  });

  it('does not flag as flaky with fewer than 3 runs', () => {
    const store = new FlakeStore(STORE_PATH);
    store.record('test-6', true);
    store.record('test-6', false);
    const score = store.getScore('test-6');
    expect(score.failureRate).toBe(0.5);
    expect(score.isFlaky).toBe(false);
  });
});
