import { diffCassettes } from '@tracepact/core';
import type { DiffPolicy, DiffResult } from '@tracepact/core';

export async function handleDiff(args: {
  cassette_a: string;
  cassette_b: string;
  ignore_keys?: string[] | undefined;
  ignore_tools?: string[] | undefined;
}): Promise<DiffResult & { error?: string }> {
  const policy: DiffPolicy = {
    ignoreKeys: args.ignore_keys ?? undefined,
    ignoreTools: args.ignore_tools ?? undefined,
  };
  try {
    return await diffCassettes(args.cassette_a, args.cassette_b, policy);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      changed: false,
      severity: 'none',
      additions: [],
      removals: [],
      diffs: [],
      error: message,
    };
  }
}
