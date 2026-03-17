import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CacheConfig, RedactionConfig } from '../config/types.js';
import { log } from '../logger.js';
import { RedactionPipeline } from '../redaction/pipeline.js';
import { type RunManifest, manifestHash } from './run-manifest.js';

export interface CacheEntry {
  manifest: RunManifest;
  result: unknown;
  checksum: string;
  createdAt: string;
  ttl?: number;
}

export interface CacheSummary {
  hash: string;
  skillHash: string;
  provider: string;
  model: string;
  createdAt: string;
  status: 'valid' | 'expired' | 'corrupted';
}

export class CacheStore {
  private readonly enabled: boolean;
  private readonly dir: string;
  private readonly ttlSeconds: number;
  private readonly verifyOnRead: boolean;
  private readonly maxEntrySizeBytes: number | undefined;
  private readonly redaction: RedactionPipeline;
  private _writeFailures = 0;

  constructor(config: CacheConfig, redactionConfig?: RedactionConfig) {
    this.enabled = config.enabled;
    this.dir = config.dir;
    this.ttlSeconds = config.ttlSeconds;
    this.verifyOnRead = config.verifyOnRead;
    this.maxEntrySizeBytes = config.maxEntrySizeBytes;
    this.redaction = new RedactionPipeline(redactionConfig);
  }

  get writeFailures(): number {
    return this._writeFailures;
  }

  private filePath(hash: string): string {
    return join(this.dir, `${hash}.json`);
  }

  async get(manifest: RunManifest): Promise<CacheEntry | null> {
    if (!this.enabled) return null;
    const hash = manifestHash(manifest);
    const path = this.filePath(hash);

    let raw: string;
    try {
      raw = await readFile(path, 'utf-8');
    } catch {
      return null;
    }

    let entry: CacheEntry;
    try {
      entry = JSON.parse(raw);
    } catch {
      log.warn(`Cache: corrupted entry at ${path}, deleting.`);
      await this.deleteFile(path);
      return null;
    }

    if (this.verifyOnRead) {
      const expectedChecksum = computeChecksum(entry.result);
      if (expectedChecksum !== entry.checksum) {
        log.warn(`Cache: checksum mismatch for ${hash}, deleting.`);
        await this.deleteFile(path);
        return null;
      }
    }

    const ttl = entry.ttl ?? this.ttlSeconds;
    const age = (Date.now() - new Date(entry.createdAt).getTime()) / 1000;
    if (age >= ttl) {
      log.info(`Cache: entry ${hash} expired (${Math.round(age)}s > ${ttl}s TTL).`);
      return null;
    }

    log.info(`Cache: hit for ${hash}.`);
    return entry;
  }

  async set(manifest: RunManifest, result: unknown): Promise<void> {
    if (!this.enabled) return;
    const hash = manifestHash(manifest);
    const redactedResult = this.redaction.redactObject(result);
    const entry: CacheEntry = {
      manifest,
      result: redactedResult,
      checksum: computeChecksum(redactedResult),
      createdAt: new Date().toISOString(),
      ttl: this.ttlSeconds,
    };

    const finalPath = this.filePath(hash);
    const tmpPath = `${finalPath}.tmp`;
    const serialized = JSON.stringify(entry, null, 2);

    if (this.maxEntrySizeBytes !== undefined && serialized.length > this.maxEntrySizeBytes) {
      log.warn(
        `Cache: entry ${hash} exceeds maxEntrySizeBytes (${serialized.length} > ${this.maxEntrySizeBytes}), skipping write.`
      );
      return;
    }

    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(tmpPath, serialized, { mode: 0o600 });
      await rename(tmpPath, finalPath);
      log.info(`Cache: stored ${hash}.`);
    } catch (err: any) {
      this._writeFailures++;
      log.warn(`Cache: write failed: ${err.message}. Continuing without cache.`);
      try {
        await this.deleteFile(tmpPath);
      } catch (cleanupErr: any) {
        log.warn(`Cache: failed to delete tmp file ${tmpPath}: ${cleanupErr.message}`);
      }
    }
  }

  async list(): Promise<CacheSummary[]> {
    const summaries: CacheSummary[] = [];
    let files: string[];
    try {
      files = await readdir(this.dir);
    } catch {
      return [];
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const hash = file.replace('.json', '');
      const path = this.filePath(hash);
      try {
        const raw = await readFile(path, 'utf-8');
        const entry: CacheEntry = JSON.parse(raw);
        const age = (Date.now() - new Date(entry.createdAt).getTime()) / 1000;
        const ttl = entry.ttl ?? this.ttlSeconds;
        const checksumOk = computeChecksum(entry.result) === entry.checksum;

        summaries.push({
          hash,
          skillHash: entry.manifest.skillHash.slice(0, 12),
          provider: entry.manifest.provider,
          model: entry.manifest.model,
          createdAt: entry.createdAt,
          status: !checksumOk ? 'corrupted' : age >= ttl ? 'expired' : 'valid',
        });
      } catch {
        summaries.push({
          hash,
          skillHash: '?',
          provider: '?',
          model: '?',
          createdAt: '?',
          status: 'corrupted',
        });
      }
    }
    return summaries;
  }

  async clear(options?: { staleOnly: boolean }): Promise<number> {
    let files: string[];
    try {
      files = await readdir(this.dir);
    } catch {
      return 0;
    }

    let deleted = 0;
    for (const file of files) {
      if (!file.endsWith('.json') && !file.endsWith('.tmp')) continue;
      const path = join(this.dir, file);

      if (file.endsWith('.tmp')) {
        await this.deleteFile(path);
        deleted++;
        continue;
      }

      if (!options?.staleOnly) {
        await this.deleteFile(path);
        deleted++;
        continue;
      }

      try {
        const raw = await readFile(path, 'utf-8');
        const entry: CacheEntry = JSON.parse(raw);
        const age = (Date.now() - new Date(entry.createdAt).getTime()) / 1000;
        const ttl = entry.ttl ?? this.ttlSeconds;
        const checksumOk = computeChecksum(entry.result) === entry.checksum;
        if (!checksumOk || age >= ttl) {
          await this.deleteFile(path);
          deleted++;
        }
      } catch {
        await this.deleteFile(path);
        deleted++;
      }
    }
    return deleted;
  }

  async verify(): Promise<{
    total: number;
    valid: number;
    corrupted: number;
    expired: number;
  }> {
    const summaries = await this.list();
    return {
      total: summaries.length,
      valid: summaries.filter((s) => s.status === 'valid').length,
      corrupted: summaries.filter((s) => s.status === 'corrupted').length,
      expired: summaries.filter((s) => s.status === 'expired').length,
    };
  }

  private async deleteFile(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      /* ignore */
    }
  }
}

function computeChecksum(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}
