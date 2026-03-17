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
 *   When omitted (e.g. for judge calls outside of runSkill), the budget is checked
 *   against the global suite accumulator so that judge token costs are also enforced.
 */
export function trackUsage(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  runTokens?: TokenAccumulator
): void {
  const entry = {
    provider,
    model,
    inputTokens,
    outputTokens,
    cached: false,
  };

  globalTokens.add(entry);
  runTokens?.add(entry);

  const rawBudget = process.env.TRACEPACT_BUDGET;
  const parsedBudget = rawBudget !== undefined ? Number(rawBudget) : undefined;
  if (parsedBudget !== undefined && !Number.isFinite(parsedBudget)) {
    throw new Error(
      `[tracepact] TRACEPACT_BUDGET="${rawBudget}" is not a valid number. Fix the environment variable or unset it to disable budget enforcement.`
    );
  }
  const budget =
    parsedBudget !== undefined && Number.isFinite(parsedBudget) ? parsedBudget : undefined;
  const budgetAccumulator = runTokens ?? globalTokens;
  if (budget && budgetAccumulator.exceedsBudget(budget)) {
    const used = budgetAccumulator.liveTokens;
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
