import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function handleRun(args: {
  skill_path: string;
  live?: boolean | undefined;
  provider?: string | undefined;
  budget?: number | undefined;
}): Promise<{
  pass: boolean;
  output: string;
  error?: string;
}> {
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

    const { stdout } = await execFileAsync('npx', vitestArgs, {
      encoding: 'utf-8',
      timeout: 120_000,
      env,
      cwd: process.cwd(),
    });

    return { pass: true, output: stdout };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string; status?: number };
    return {
      pass: false,
      output: error.stdout ?? '',
      error: error.stderr ?? error.message ?? 'Unknown error',
    };
  }
}
