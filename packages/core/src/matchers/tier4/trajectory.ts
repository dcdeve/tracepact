import type { AgentDriver } from '../../driver/types.js';
import type { ToolTrace } from '../../trace/types.js';
import type { MatcherResult } from '../types.js';
import { type JudgeConfig, JudgeExecutor } from './judge.js';

export interface TrajectoryConfig {
  required?: string[];
  forbidden?: string[];
  order?: string[];
  judge?: {
    criteria: string;
    driver?: AgentDriver;
    model?: string;
  };
  strict?: boolean;
}

export interface TrajectoryResult extends MatcherResult {
  tier0: boolean;
  tier4?: boolean;
}

export function buildTraceSummary(trace: ToolTrace): string {
  if (trace.calls.length === 0) return '(empty trace — no tool calls)';
  return trace.calls
    .map((c) => {
      const argsPreview = JSON.stringify(c.args).slice(0, 120);
      return `[${c.sequenceIndex}] ${c.toolName}(${argsPreview}) → ${c.result.type}`;
    })
    .join('\n');
}

function checkRequired(trace: ToolTrace, required: string[]): string[] {
  const calledTools = new Set(trace.calls.map((c) => c.toolName));
  return required.filter((name) => !calledTools.has(name));
}

function checkForbidden(trace: ToolTrace, forbidden: string[]): string[] {
  const calledTools = new Set(trace.calls.map((c) => c.toolName));
  return forbidden.filter((name) => calledTools.has(name));
}

function checkOrder(trace: ToolTrace, order: string[], strict: boolean): boolean {
  const calledNames = trace.calls.map((c) => c.toolName);

  if (strict) {
    // Exact sequence match
    const filtered = calledNames.filter((name) => order.includes(name));
    return JSON.stringify(filtered) === JSON.stringify(order);
  }

  // Relative order: each tool in order[] appears after the previous one
  let lastIdx = -1;
  for (const name of order) {
    const idx = calledNames.indexOf(name, lastIdx + 1);
    if (idx === -1) return false;
    lastIdx = idx;
  }
  return true;
}

export async function toMatchTrajectory(
  result: { trace: ToolTrace; output: string },
  config: TrajectoryConfig
): Promise<TrajectoryResult> {
  const { trace } = result;
  const diagnosticParts: string[] = [];

  // --- Tier 0: deterministic constraints ---
  if (config.required) {
    const missing = checkRequired(trace, config.required);
    if (missing.length > 0) {
      return {
        pass: false,
        message: `Trajectory: FAIL — required tools missing: ${missing.join(', ')}`,
        tier: 0,
        tier0: false,
        diagnostic: {
          expected: `required tools: ${config.required.join(', ')}`,
          received: `missing: ${missing.join(', ')}`,
          tokens: 0,
        },
      };
    }
  }

  if (config.forbidden) {
    const found = checkForbidden(trace, config.forbidden);
    if (found.length > 0) {
      return {
        pass: false,
        message: `Trajectory: FAIL — forbidden tools called: ${found.join(', ')}`,
        tier: 0,
        tier0: false,
        diagnostic: {
          expected: `forbidden tools not called: ${config.forbidden.join(', ')}`,
          received: `called: ${found.join(', ')}`,
          tokens: 0,
        },
      };
    }
  }

  if (config.order) {
    const strict = config.strict ?? false;
    const orderOk = checkOrder(trace, config.order, strict);
    if (!orderOk) {
      const actual = trace.calls.map((c) => c.toolName).join(' → ');
      return {
        pass: false,
        message: `Trajectory: FAIL — order constraint violated (${strict ? 'strict' : 'relative'})`,
        tier: 0,
        tier0: false,
        diagnostic: {
          expected: `order: ${config.order.join(' → ')}`,
          received: actual,
          tokens: 0,
        },
      };
    }
  }

  // Tier 0 passed
  diagnosticParts.push('Tier 0 (deterministic): PASS');

  // --- Tier 4: semantic judge on trace (optional) ---
  if (config.judge) {
    const driver = config.judge.driver;
    if (!driver) {
      return {
        pass: false,
        message: 'toMatchTrajectory with judge requires a driver.',
        tier: 4,
        tier0: true,
        diagnostic: {
          expected: config.judge.criteria,
          received: 'no driver configured',
          tokens: 0,
        },
      };
    }

    const traceSummary = buildTraceSummary(trace);
    const judgePrompt = `${config.judge.criteria}\n\n## Agent Trace\n${traceSummary}\n\n## Agent Output\n${result.output}`;

    const judgeConfig: JudgeConfig = {
      criteria: judgePrompt,
      ...(config.judge.model ? { model: config.judge.model } : {}),
    };
    const executor = new JudgeExecutor(driver);
    const judgeResult = await executor.evaluate(result.output, judgeConfig);

    if (!judgeResult.pass) {
      return {
        pass: false,
        message: `Trajectory: Tier 0 PASS, Tier 4 FAIL — ${judgeResult.justification}`,
        tier: 4,
        tier0: true,
        tier4: false,
        diagnostic: {
          expected: config.judge.criteria,
          received: judgeResult.justification,
          suggestion: `Trace summary sent to judge:\n${traceSummary}`,
          tokens: judgeResult.tokens,
        },
      };
    }

    return {
      pass: true,
      message: `Trajectory: PASS (Tier 0 + Tier 4). ${judgeResult.justification}`,
      tier: 4,
      tier0: true,
      tier4: true,
      diagnostic: {
        expected: config.judge.criteria,
        received: judgeResult.justification,
        tokens: judgeResult.tokens,
      },
    };
  }

  // Tier 0 only (no judge)
  return {
    pass: true,
    message: 'Trajectory: PASS (Tier 0 only — no judge configured)',
    tier: 0,
    tier0: true,
    diagnostic: {
      expected: 'trajectory constraints',
      received: 'all constraints satisfied',
      tokens: 0,
    },
  };
}
