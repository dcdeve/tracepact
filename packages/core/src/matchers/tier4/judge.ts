import type { AgentDriver } from '../../driver/types.js';
import { log } from '../../logger.js';
import { MockSandbox } from '../../sandbox/mock-sandbox.js';
import type { CalibrationSet } from './calibration.js';
import { loadBundledCalibration } from './calibration.js';

export interface JudgeConfig {
  criteria: string;
  calibration?: string | CalibrationSet;
  model?: string;
  provider?: string;
  consensus?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface JudgeVote {
  pass: boolean;
  confidence: number;
  justification: string;
  reasoning: string;
  tokens: number;
}

export interface JudgeResult {
  pass: boolean;
  confidence: number;
  justification: string;
  reasoning: string;
  tokens: number;
  votes: JudgeVote[];
  consensus: { passed: number; failed: number; total: number };
}

export class JudgeExecutor {
  private driver: AgentDriver;

  constructor(driver: AgentDriver) {
    this.driver = driver;
  }

  async evaluate(output: string, config: JudgeConfig): Promise<JudgeResult> {
    const consensusCount = config.consensus ?? 1;
    const votes: JudgeVote[] = [];

    const calibration = await this.resolveCalibration(config.calibration);
    const prompt = buildJudgePrompt(output, config.criteria, calibration);

    for (let i = 0; i < consensusCount; i++) {
      const vote = await this.singleJudge(prompt, {
        temperature: config.temperature ?? (consensusCount > 1 ? 0.3 : 0),
        maxTokens: config.maxTokens ?? 1024,
      });
      votes.push(vote);
    }

    const passed = votes.filter((v) => v.pass).length;
    const totalTokens = votes.reduce((sum, v) => sum + v.tokens, 0);
    const majorityPass = passed > consensusCount / 2;

    const bestVote = votes.reduce((best, v) => (v.confidence > best.confidence ? v : best));

    return {
      pass: majorityPass,
      confidence: bestVote.confidence,
      justification: bestVote.justification,
      reasoning: bestVote.reasoning,
      tokens: totalTokens,
      votes,
      consensus: { passed, failed: consensusCount - passed, total: consensusCount },
    };
  }

  private async singleJudge(
    prompt: string,
    config: { temperature: number; maxTokens: number }
  ): Promise<JudgeVote> {
    const sandbox = new MockSandbox({});

    const result = await this.driver.run({
      skill: {
        systemPrompt:
          'You are a precise evaluator. Always respond with the exact JSON format requested.',
      },
      prompt,
      sandbox,
      config: { temperature: config.temperature, maxTokens: config.maxTokens },
    });

    const jsonMatch =
      result.output.match(/```json\s*\n([\s\S]*?)```/) ??
      result.output.match(/(\{[\s\S]*"pass"[\s\S]*\})/);

    if (!jsonMatch) {
      log.warn('Judge returned non-JSON response. Treating as fail.');
      return {
        pass: false,
        confidence: 0,
        justification: 'Judge response could not be parsed.',
        reasoning: result.output,
        tokens: result.usage.inputTokens + result.usage.outputTokens,
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
      return {
        pass: Boolean(parsed.pass),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        justification: String(parsed.justification || ''),
        reasoning: String(parsed.reasoning || ''),
        tokens: result.usage.inputTokens + result.usage.outputTokens,
      };
    } catch {
      log.warn('Judge returned malformed JSON. Treating as fail.');
      return {
        pass: false,
        confidence: 0,
        justification: 'Malformed JSON from judge.',
        reasoning: result.output,
        tokens: result.usage.inputTokens + result.usage.outputTokens,
      };
    }
  }

  private resolveCalibration(input?: string | CalibrationSet): CalibrationSet | undefined {
    if (!input) return undefined;
    if (typeof input !== 'string') return input;
    return loadBundledCalibration(input);
  }
}

export function buildJudgePrompt(
  output: string,
  criteria: string,
  calibration?: CalibrationSet
): string {
  let prompt = `You are an evaluator. Your job is to determine whether an AI agent's output meets specific criteria.

## Criteria
${criteria}

`;

  if (calibration && calibration.examples.length > 0) {
    prompt += '## Calibration Examples\n\n';
    for (const ex of calibration.examples) {
      prompt += `### Example (${ex.pass ? 'PASS' : 'FAIL'})
**Input:** ${ex.input}
**Output:** ${ex.output}
**Verdict:** ${ex.pass ? 'PASS' : 'FAIL'} — ${ex.justification}

`;
    }
  }

  prompt += `## Output to Evaluate
${output}

## Instructions
Think step-by-step about whether the output meets the criteria. Then respond with EXACTLY this JSON format:

\`\`\`json
{
  "pass": true or false,
  "confidence": 0.0 to 1.0,
  "justification": "one sentence explaining the verdict",
  "reasoning": "step-by-step reasoning that led to this conclusion"
}
\`\`\``;

  return prompt;
}
