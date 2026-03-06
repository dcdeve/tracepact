import { CacheStore } from '@tracepact/core';

const DEFAULT_CACHE_CONFIG = {
  enabled: true,
  dir: '.tracepact/cache',
  ttlSeconds: 86400,
  verifyOnRead: true,
};

interface ClearOptions {
  stale?: boolean;
}

export async function cache(subcommand: string, opts: ClearOptions): Promise<void> {
  const store = new CacheStore(DEFAULT_CACHE_CONFIG);

  switch (subcommand) {
    case 'list': {
      const entries = await store.list();
      if (entries.length === 0) {
        console.log('Cache is empty.');
        return;
      }
      console.log(
        `${'Hash'.padEnd(14)} ${'Provider'.padEnd(10)} ${'Model'.padEnd(30)} ${'Age'.padEnd(10)} Status`
      );
      console.log('-'.repeat(80));
      for (const e of entries) {
        const age = timeSince(e.createdAt);
        console.log(
          `${e.hash.slice(0, 12)}  ${e.provider.padEnd(10)} ${e.model.padEnd(30)} ${age.padEnd(10)} ${e.status}`
        );
      }
      break;
    }
    case 'clear': {
      const deleted = await store.clear(opts.stale ? { staleOnly: true } : undefined);
      console.log(`Deleted ${deleted} cache ${deleted === 1 ? 'entry' : 'entries'}.`);
      break;
    }
    case 'verify': {
      const report = await store.verify();
      console.log(
        `Total: ${report.total}  Valid: ${report.valid}  Expired: ${report.expired}  Corrupted: ${report.corrupted}`
      );
      if (report.corrupted > 0) process.exit(1);
      break;
    }
    default:
      console.error(`Unknown cache command: "${subcommand}". Use: list, clear, verify`);
      process.exit(2);
  }
}

function timeSince(iso: string): string {
  if (iso === '?') return '?';
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}
