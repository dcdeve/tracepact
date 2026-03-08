import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface DiffToolCall {
  toolName: string;
  args: Record<string, unknown>;
  sequenceIndex: number;
}

export interface ArgDiff {
  toolName: string;
  sequenceIndex: number;
  key: string;
  a: unknown;
  b: unknown;
}

export type DiffSeverity = 'none' | 'warn' | 'block';

export interface DiffPolicy {
  /** Arg keys to exclude from comparison (e.g. 'timestamp', 'requestId'). */
  ignoreKeys?: string[] | undefined;
  /** Tool names to exclude from comparison entirely. */
  ignoreTools?: string[] | undefined;
}

export interface DiffResult {
  changed: boolean;
  severity: DiffSeverity;
  additions: DiffToolCall[];
  removals: DiffToolCall[];
  diffs: ArgDiff[];
  metadata?: {
    a: { prompt: string; model: string; provider: string; recordedAt: string };
    b: { prompt: string; model: string; provider: string; recordedAt: string };
  };
}

/**
 * Compare two cassette files and return behavioral differences.
 *
 * Matches tool calls by sequence index. Reports:
 * - additions: calls in B that don't exist in A
 * - removals: calls in A that don't exist in B
 * - diffs: same tool at same index but different arguments
 *
 * Severity:
 * - 'block' — tools added or removed (structural change)
 * - 'warn'  — args changed on existing tools
 * - 'none'  — no differences (or all filtered by policy)
 */
export async function diffCassettes(
  cassettePathA: string,
  cassettePathB: string,
  policy?: DiffPolicy
): Promise<DiffResult> {
  const [rawA, rawB] = await Promise.all([
    readFile(resolve(cassettePathA), 'utf-8'),
    readFile(resolve(cassettePathB), 'utf-8'),
  ]);

  const cassetteA = JSON.parse(rawA);
  const cassetteB = JSON.parse(rawB);

  const ignoredTools = new Set(policy?.ignoreTools ?? []);
  const ignoredKeys = new Set(policy?.ignoreKeys ?? []);

  const filterCalls = (calls: Array<Record<string, unknown>>): DiffToolCall[] =>
    calls
      .filter((c) => !ignoredTools.has(c.toolName as string))
      .map((c, i) => ({
        toolName: c.toolName as string,
        args: c.args as Record<string, unknown>,
        sequenceIndex: i,
      }));

  const callsA = filterCalls(cassetteA.result.trace.calls);
  const callsB = filterCalls(cassetteB.result.trace.calls);

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
        const allKeys = new Set([...Object.keys(a.args), ...Object.keys(b.args)]);
        for (const key of allKeys) {
          if (ignoredKeys.has(key)) continue;
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

  const severity: DiffSeverity =
    additions.length > 0 || removals.length > 0 ? 'block' : diffs.length > 0 ? 'warn' : 'none';

  const metadata = {
    a: {
      prompt: cassetteA.metadata?.prompt ?? '',
      model: cassetteA.metadata?.model ?? '',
      provider: cassetteA.metadata?.provider ?? '',
      recordedAt: cassetteA.recordedAt ?? '',
    },
    b: {
      prompt: cassetteB.metadata?.prompt ?? '',
      model: cassetteB.metadata?.model ?? '',
      provider: cassetteB.metadata?.provider ?? '',
      recordedAt: cassetteB.recordedAt ?? '',
    },
  };

  return { changed, severity, additions, removals, diffs, metadata };
}
