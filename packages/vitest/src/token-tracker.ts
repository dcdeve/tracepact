import { mkdirSync, writeFileSync } from 'node:fs';
import { TokenAccumulator } from '@tracepact/core';

export const globalTokens = new TokenAccumulator();

/**
 * Record token usage from a live run.
 * Throws if the budget (TRACEPACT_BUDGET env var, in tokens) is exceeded.
 *
 * @param runTokens - A per-run accumulator used for budget enforcement.
 *   This must be a fresh TokenAccumulator created at the start of each runSkill()
 *   call so that budget checks are scoped to a single run, not the entire test suite.
 */
export function trackUsage(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  runTokens: TokenAccumulator
): void {
  const entry = {
    provider,
    model,
    inputTokens,
    outputTokens,
    cached: false,
  };

  globalTokens.add(entry);
  runTokens.add(entry);

  const budget = process.env.TRACEPACT_BUDGET ? Number(process.env.TRACEPACT_BUDGET) : undefined;
  if (budget && runTokens.exceedsBudget(budget)) {
    const used = runTokens.liveTokens;
    throw new Error(
      `Token budget exceeded: ${used.toLocaleString()} tokens used > ${budget.toLocaleString()} budget. Aborting to prevent runaway costs. Adjust --budget or TRACEPACT_BUDGET to increase the limit.`
    );
  }
}

/** Write token report to .tracepact/last-run-tokens.json if any tokens were used. */
export function writeTokenReport(): void {
  if (globalTokens.totalTokens === 0) return;
  mkdirSync('.tracepact', { recursive: true });
  writeFileSync('.tracepact/last-run-tokens.json', globalTokens.toJSON());
}
