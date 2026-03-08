import { diffCassettes } from '@tracepact/core';
import type { ArgDiff, DiffPolicy, DiffResult, DiffSeverity, DiffToolCall } from '@tracepact/core';

const SEVERITY_ORDER: DiffSeverity[] = ['none', 'warn', 'block'];

interface DiffOptions {
  json?: boolean;
  exitOnChange?: boolean;
  failOn?: string;
  ignoreKeys?: string;
  ignoreTools?: string;
}

function parseList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function diff(cassetteA: string, cassetteB: string, opts: DiffOptions): Promise<void> {
  const policy: DiffPolicy = {
    ignoreKeys: parseList(opts.ignoreKeys),
    ignoreTools: parseList(opts.ignoreTools),
  };

  let result: DiffResult;
  try {
    result = await diffCassettes(cassetteA, cassetteB, policy);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error comparing cassettes: ${message}`);
    process.exitCode = 2;
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printSummary(result, cassetteA, cassetteB);
  }

  // --fail-on <severity> supersedes --exit-on-change
  if (opts.failOn) {
    const threshold = opts.failOn as DiffSeverity;
    const thresholdIdx = SEVERITY_ORDER.indexOf(threshold);
    const actualIdx = SEVERITY_ORDER.indexOf(result.severity);
    if (thresholdIdx >= 0 && actualIdx >= thresholdIdx) {
      process.exitCode = 1;
    }
  } else if (opts.exitOnChange && result.changed) {
    process.exitCode = 1;
  }
}

function severityLabel(s: DiffSeverity): string {
  if (s === 'block') return 'BLOCK';
  if (s === 'warn') return 'WARN';
  return 'OK';
}

function printSummary(result: DiffResult, pathA: string, pathB: string): void {
  console.log('');
  console.log('  Comparing cassettes');
  console.log(`  A: ${pathA}`);
  console.log(`  B: ${pathB}`);

  if (result.metadata) {
    const { a, b } = result.metadata;
    if (a.model !== b.model) {
      console.log(`  Model: ${a.model} -> ${b.model}`);
    }
    if (a.provider !== b.provider) {
      console.log(`  Provider: ${a.provider} -> ${b.provider}`);
    }
  }

  console.log('');

  if (!result.changed) {
    console.log('  No behavioral changes detected.');
    console.log('');
    return;
  }

  const totalChanges = result.additions.length + result.removals.length + result.diffs.length;
  console.log(`  ${totalChanges} change${totalChanges === 1 ? '' : 's'} detected:`);
  console.log('');

  for (const removal of result.removals) {
    console.log(`  - ${formatToolCall(removal)} (removed)`);
  }

  for (const addition of result.additions) {
    console.log(`  + ${formatToolCall(addition)} (added)`);
  }

  for (const argDiff of result.diffs) {
    console.log(`  ~ ${formatArgDiff(argDiff)}`);
  }

  console.log('');
  const parts: string[] = [];
  if (result.removals.length > 0) parts.push(`${result.removals.length} removed`);
  if (result.additions.length > 0) parts.push(`${result.additions.length} added`);
  if (result.diffs.length > 0) parts.push(`${result.diffs.length} arg changed`);
  console.log(`  Summary: ${parts.join(', ')}  [${severityLabel(result.severity)}]`);
  console.log('');
}

function formatToolCall(call: DiffToolCall): string {
  return `${call.toolName} (seq ${call.sequenceIndex})`;
}

function formatArgDiff(d: ArgDiff): string {
  const a = d.a === undefined ? '(missing)' : JSON.stringify(d.a);
  const b = d.b === undefined ? '(missing)' : JSON.stringify(d.b);
  return `${d.toolName}.${d.key}: ${a} -> ${b}`;
}
