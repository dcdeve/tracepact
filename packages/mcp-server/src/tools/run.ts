import { execFileSync } from 'node:child_process';

export function handleRun(args: {
  skill_path: string;
  live?: boolean | undefined;
  provider?: string | undefined;
  budget?: number | undefined;
}): {
  pass: boolean;
  output: string;
  error?: string;
} {
  try {
    const vitestArgs = ['tracepact', 'run', '--json'];

    const env: Record<string, string> = { ...(process.env as Record<string, string>) };

    if (args.live) {
      env.TRACEPACT_LIVE = '1';
    }
    if (args.provider) {
      env.TRACEPACT_PROVIDER = args.provider;
    }
    if (args.budget !== undefined) {
      env.TRACEPACT_BUDGET = String(args.budget);
    }

    const result = execFileSync('npx', vitestArgs, {
      encoding: 'utf-8',
      timeout: 120_000,
      env,
      cwd: process.cwd(),
    });

    return { pass: true, output: result };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string; status?: number };
    return {
      pass: false,
      output: error.stdout ?? '',
      error: error.stderr ?? error.message ?? 'Unknown error',
    };
  }
}
