import type { AgentDriver } from '../../driver/types.js';
import type { MatcherResult } from '../types.js';
import { type JudgeConfig, JudgeExecutor } from './judge.js';

export type { JudgeConfig, JudgeResult, JudgeVote } from './judge.js';
export { JudgeExecutor, buildJudgePrompt } from './judge.js';
export type { CalibrationSet, CalibrationExample } from './calibration.js';
export { loadBundledCalibration, loadCustomCalibration } from './calibration.js';
export type { TrajectoryConfig, TrajectoryResult } from './trajectory.js';
export { toMatchTrajectory, buildTraceSummary } from './trajectory.js';

export interface ToPassJudgeOptions extends Omit<JudgeConfig, 'criteria'> {
  driver?: AgentDriver;
}

export async function toPassJudge(
  output: string,
  criteria: string,
  options?: ToPassJudgeOptions
): Promise<MatcherResult> {
  const driver = options?.driver;
  if (!driver) {
    return {
      pass: false,
      message:
        'toPassJudge requires a driver. Pass { driver } in options or configure a default provider.',
      tier: 4,
      diagnostic: {
        expected: criteria,
        received: 'no driver configured',
        tokens: 0,
      },
    };
  }

  const config: JudgeConfig = { criteria, ...options };
  const executor = new JudgeExecutor(driver);
  let result: Awaited<ReturnType<typeof executor.evaluate>>;
  try {
    result = await executor.evaluate(output, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      pass: false,
      message: `API unavailable: ${message}`,
      tier: 4,
      diagnostic: {
        expected: criteria,
        received: 'API error',
        tokens: 0,
      },
    };
  }

  if (result.pass) {
    return {
      pass: true,
      message: `Judge: PASS (${result.confidence.toFixed(2)} confidence). ${result.justification}`,
      tier: 4,
      diagnostic: {
        expected: criteria,
        received: result.justification,
        tokens: result.tokens,
      },
    };
  }

  return {
    pass: false,
    message: `Judge: FAIL (${result.confidence.toFixed(2)} confidence). ${result.justification}`,
    tier: 4,
    diagnostic: {
      expected: criteria,
      received: result.justification,
      suggestion:
        result.consensus.total > 1
          ? `Consensus: ${result.consensus.passed}/${result.consensus.total} judges passed.`
          : '',
      tokens: result.tokens,
    },
  };
}
