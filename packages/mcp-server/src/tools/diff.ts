import { diffCassettes } from '@tracepact/core';
import type { DiffPolicy, DiffResult } from '@tracepact/core';

export async function handleDiff(args: {
  cassette_a: string;
  cassette_b: string;
  ignore_keys?: string[] | undefined;
  ignore_tools?: string[] | undefined;
}): Promise<DiffResult> {
  const policy: DiffPolicy = {
    ignoreKeys: args.ignore_keys ?? undefined,
    ignoreTools: args.ignore_tools ?? undefined,
  };
  try {
    return await diffCassettes(args.cassette_a, args.cassette_b, policy);
  } catch (err: unknown) {
    console.error('[tracepact] diff failed:', err);
    throw err;
  }
}
