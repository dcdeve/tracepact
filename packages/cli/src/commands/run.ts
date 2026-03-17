import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

interface RunOptions {
  live?: boolean;
  full?: boolean;
  record?: boolean;
  replay?: string;
  cache?: boolean; // commander turns --no-cache into cache: false
  healthCheckStrict?: boolean;
  budget?: string;
  json?: boolean;
  provider?: string;
}

export async function runTests(opts: RunOptions, passthroughArgs: string[] = []): Promise<void> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };

  if (opts.live) env.TRACEPACT_LIVE = '1';
  if (opts.full) {
    env.TRACEPACT_FULL = '1';
    env.TRACEPACT_LIVE = '1';
  }
  if (opts.record) {
    env.TRACEPACT_RECORD = '1';
    env.TRACEPACT_LIVE = '1';
  }
  if (opts.replay) env.TRACEPACT_REPLAY = opts.replay;
  if (opts.cache === false) env.TRACEPACT_NO_CACHE = '1';
  if (opts.healthCheckStrict) env.TRACEPACT_HEALTH_CHECK_STRICT = '1';
  if (opts.budget) env.TRACEPACT_BUDGET = opts.budget;
  if (opts.json) env.TRACEPACT_JSON_REPORTER = '1';
  if (opts.provider) env.TRACEPACT_PROVIDER = opts.provider;

  // Reject --config in passthrough to prevent silent clobber
  if (passthroughArgs.some((a) => a === '--config' || a.startsWith('--config='))) {
    console.error(
      'Error: --config is managed by tracepact. Use tracepact.vitest.ts instead.\n' +
        'Pass vitest flags after -- if needed: tracepact run --live -- --reporter=verbose'
    );
    process.exitCode = 2;
    return;
  }

  const configPath = findConfig();
  if (!configPath) return;

  const vitestArgs = ['vitest', 'run', '--config', configPath, ...passthroughArgs];

  try {
    execFileSync('npx', vitestArgs, { stdio: 'inherit', env });
  } catch (err: any) {
    process.exitCode = err.status ?? 1;
  }
}

function findConfig(): string | undefined {
  const candidates = ['tracepact.vitest.ts', 'tracepact.vitest.js', 'vitest.config.ts'];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  console.error('No tracepact.vitest.ts found. Run `tracepact init` first.');
  process.exitCode = 2;
  return undefined;
}
