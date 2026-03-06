import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface DiffToolCall {
  toolName: string;
  args: Record<string, unknown>;
  sequenceIndex: number;
}

interface ArgDiff {
  toolName: string;
  sequenceIndex: number;
  key: string;
  a: unknown;
  b: unknown;
}

export function handleDiff(args: { cassette_a: string; cassette_b: string }): {
  changed: boolean;
  additions: DiffToolCall[];
  removals: DiffToolCall[];
  diffs: ArgDiff[];
  error?: string;
} {
  try {
    const rawA = readFileSync(resolve(args.cassette_a), 'utf-8');
    const rawB = readFileSync(resolve(args.cassette_b), 'utf-8');
    const cassetteA = JSON.parse(rawA);
    const cassetteB = JSON.parse(rawB);

    const callsA: DiffToolCall[] = cassetteA.result.trace.calls.map(
      (c: Record<string, unknown>) => ({
        toolName: c.toolName as string,
        args: c.args as Record<string, unknown>,
        sequenceIndex: c.sequenceIndex as number,
      })
    );

    const callsB: DiffToolCall[] = cassetteB.result.trace.calls.map(
      (c: Record<string, unknown>) => ({
        toolName: c.toolName as string,
        args: c.args as Record<string, unknown>,
        sequenceIndex: c.sequenceIndex as number,
      })
    );

    // Find additions (in B but not in A by tool name at same index)
    const additions: DiffToolCall[] = [];
    const removals: DiffToolCall[] = [];
    const diffs: ArgDiff[] = [];

    const maxLen = Math.max(callsA.length, callsB.length);

    for (let i = 0; i < maxLen; i++) {
      const a = callsA[i];
      const b = callsB[i];

      if (!a && b) {
        additions.push(b);
      } else if (a && !b) {
        removals.push(a);
      } else if (a && b) {
        if (a.toolName !== b.toolName) {
          removals.push(a);
          additions.push(b);
        } else {
          // Compare args
          const allKeys = new Set([...Object.keys(a.args), ...Object.keys(b.args)]);
          for (const key of allKeys) {
            const valA = a.args[key];
            const valB = b.args[key];
            if (JSON.stringify(valA) !== JSON.stringify(valB)) {
              diffs.push({
                toolName: a.toolName,
                sequenceIndex: i,
                key,
                a: valA,
                b: valB,
              });
            }
          }
        }
      }
    }

    const changed = additions.length > 0 || removals.length > 0 || diffs.length > 0;
    return { changed, additions, removals, diffs };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { changed: false, additions: [], removals: [], diffs: [], error: message };
  }
}
