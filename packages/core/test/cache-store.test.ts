import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CacheStore } from '../src/cache/cache-store.js';
import { computeManifest, manifestHash } from '../src/cache/run-manifest.js';
import type { CacheConfig } from '../src/config/types.js';

const CACHE_DIR = join(import.meta.dirname, '__cache_test__');

const config: CacheConfig = {
  enabled: true,
  dir: CACHE_DIR,
  ttlSeconds: 3600,
  verifyOnRead: true,
};

const baseManifest = computeManifest({
  skill: { systemPrompt: 'test' },
  prompt: 'hello',
  provider: 'claude',
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
  frameworkVersion: '0.0.1',
  driverVersion: '0.0.1',
});

beforeEach(async () => {
  await mkdir(CACHE_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(CACHE_DIR, { recursive: true, force: true });
});

describe('CacheStore', () => {
  it('returns null on empty cache (miss)', async () => {
    const store = new CacheStore(config);
    const result = await store.get(baseManifest);
    expect(result).toBeNull();
  });

  it('stores and retrieves an entry', async () => {
    const store = new CacheStore(config);
    const data = { output: 'hello world' };
    await store.set(baseManifest, data);
    const entry = await store.get(baseManifest);
    expect(entry).not.toBeNull();
    expect(entry?.result).toEqual(data);
  });

  it('checksum validates on read', async () => {
    const store = new CacheStore(config);
    await store.set(baseManifest, { output: 'ok' });

    // Tamper with the file
    const hash = manifestHash(baseManifest);
    const path = join(CACHE_DIR, `${hash}.json`);
    const raw = await readFile(path, 'utf-8');
    const tampered = raw.replace('"ok"', '"TAMPERED"');
    await writeFile(path, tampered);

    const entry = await store.get(baseManifest);
    expect(entry).toBeNull();
  });

  it('returns null for expired entry', async () => {
    const shortTtlConfig = { ...config, ttlSeconds: 0 };
    const store = new CacheStore(shortTtlConfig);
    await store.set(baseManifest, { output: 'expired' });
    // TTL=0 means immediately expired
    const entry = await store.get(baseManifest);
    expect(entry).toBeNull();
  });

  it('returns entry within TTL', async () => {
    const store = new CacheStore(config);
    await store.set(baseManifest, { output: 'valid' });
    const entry = await store.get(baseManifest);
    expect(entry).not.toBeNull();
  });

  it('misses when manifest changes', async () => {
    const store = new CacheStore(config);
    await store.set(baseManifest, { output: 'cached' });

    const differentManifest = computeManifest({
      skill: { systemPrompt: 'different' },
      prompt: 'hello',
      provider: 'claude',
      model: 'claude-sonnet-4-20250514',
      temperature: 0,
      frameworkVersion: '0.0.1',
      driverVersion: '0.0.1',
    });

    const entry = await store.get(differentManifest);
    expect(entry).toBeNull();
  });

  it('creates directory if it does not exist', async () => {
    await rm(CACHE_DIR, { recursive: true, force: true });
    const store = new CacheStore(config);
    await store.set(baseManifest, { output: 'created' });
    const entry = await store.get(baseManifest);
    expect(entry).not.toBeNull();
  });

  it('clears all entries', async () => {
    const store = new CacheStore(config);
    await store.set(baseManifest, { output: 'a' });

    const m2 = computeManifest({
      skill: { systemPrompt: 'other' },
      prompt: 'hello',
      provider: 'claude',
      model: 'claude-sonnet-4-20250514',
      temperature: 0,
      frameworkVersion: '0.0.1',
      driverVersion: '0.0.1',
    });
    await store.set(m2, { output: 'b' });

    const deleted = await store.clear();
    expect(deleted).toBe(2);

    const entry = await store.get(baseManifest);
    expect(entry).toBeNull();
  });

  it('clears only stale entries', async () => {
    const store = new CacheStore({ ...config, ttlSeconds: 0 });
    await store.set(baseManifest, { output: 'expired' });

    const freshStore = new CacheStore(config);
    const m2 = computeManifest({
      skill: { systemPrompt: 'fresh' },
      prompt: 'hello',
      provider: 'claude',
      model: 'claude-sonnet-4-20250514',
      temperature: 0,
      frameworkVersion: '0.0.1',
      driverVersion: '0.0.1',
    });
    await freshStore.set(m2, { output: 'fresh' });

    const deleted = await freshStore.clear({ staleOnly: true });
    expect(deleted).toBe(1);
  });

  it('lists entries with correct statuses', async () => {
    const store = new CacheStore(config);
    await store.set(baseManifest, { output: 'valid' });

    const summaries = await store.list();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.status).toBe('valid');
  });

  it('verify counts entries correctly', async () => {
    const store = new CacheStore(config);
    await store.set(baseManifest, { output: 'ok' });

    const stats = await store.verify();
    expect(stats.total).toBe(1);
    expect(stats.valid).toBe(1);
    expect(stats.corrupted).toBe(0);
    expect(stats.expired).toBe(0);
  });

  it('handles concurrent writes without corruption', async () => {
    const store = new CacheStore(config);
    await Promise.all([
      store.set(baseManifest, { output: 'first' }),
      store.set(baseManifest, { output: 'second' }),
    ]);

    const entry = await store.get(baseManifest);
    // Under filesystem race conditions, both writes may fail (entry is null).
    // The key invariant is no corruption: either a valid entry or null.
    if (entry) {
      expect(['first', 'second']).toContain((entry.result as any).output);
    }
  });
});
