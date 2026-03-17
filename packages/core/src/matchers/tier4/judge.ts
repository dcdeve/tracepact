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
  /** Timeout in milliseconds for a single judge LLM call. */
  timeout?: number;
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
  /** Errors from individual voters that failed, if any. Only present when at least one voter errored. */
  voterErrors?: string[];
}

function extractFirstValidJson(text: string): string | null {
  let start = text.indexOf('{');
  while (start !== -1) {
    let depth = 0;
    let inString = false;
    let isEscaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        isEscaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            break;
          }
        }
      }
    }
    start = text.indexOf('{', start + 1);
  }
  return null;
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

    const voterErrors: string[] = [];

    for (let i = 0; i < consensusCount; i++) {
      try {
        const vote = await this.singleJudge(prompt, {
          temperature: config.temperature ?? (consensusCount > 1 ? 0.3 : 0),
          maxTokens: config.maxTokens ?? 1024,
          ...(config.timeout !== undefined ? { timeout: config.timeout } : {}),
        });
        votes.push(vote);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`Judge voter ${i + 1}/${consensusCount} failed: ${message}`);
        voterErrors.push(message);
      }
    }

    if (votes.length === 0) {
      const combined = voterErrors.join('; ');
      throw new Error(`All ${consensusCount} judge voter(s) failed: ${combined}`);
    }

    const passed = votes.filter((v) => v.pass).length;
    const totalTokens = votes.reduce((sum, v) => sum + v.tokens, 0);
    const majorityPass = passed > votes.length / 2;

    const bestVote = votes.reduce((best, v) => (v.confidence > best.confidence ? v : best));

    return {
      pass: majorityPass,
      confidence: bestVote.confidence,
      justification: bestVote.justification,
      reasoning: bestVote.reasoning,
      tokens: totalTokens,
      votes,
      consensus: { passed, failed: votes.length - passed, total: votes.length },
      ...(voterErrors.length > 0 ? { voterErrors } : {}),
    };
  }

  private async singleJudge(
    prompt: string,
    config: { temperature: number; maxTokens: number; timeout?: number }
  ): Promise<JudgeVote> {
    const sandbox = new MockSandbox({});

    let result: Awaited<ReturnType<typeof this.driver.run>>;
    try {
      result = await this.driver.run({
        skill: {
          systemPrompt:
            'You are a precise evaluator. Always respond with the exact JSON format requested.',
        },
        prompt,
        sandbox,
        config: {
          ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
          ...(config.maxTokens !== undefined ? { maxTokens: config.maxTokens } : {}),
          ...(config.timeout !== undefined ? { timeout: config.timeout } : {}),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Judge API call failed: ${message}`, { cause: err });
    }

    const fenceMatch = result.output.match(/```json\s*\n([\s\S]*?)```/);
    const rawCandidate = fenceMatch ? (fenceMatch[1] ?? '') : extractFirstValidJson(result.output);

    if (rawCandidate === null) {
      throw new Error(`Judge parse error: no JSON found in response. Raw output: ${result.output}`);
    }

    try {
      const parsed = JSON.parse(rawCandidate);
      return {
        pass: Boolean(parsed.pass),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        justification: String(parsed.justification || ''),
        reasoning: String(parsed.reasoning || ''),
        tokens: result.usage.inputTokens + result.usage.outputTokens,
      };
    } catch {
      throw new Error(
        `Judge parse error: malformed JSON extracted from response. Extracted: ${rawCandidate}. Raw output: ${result.output}`
      );
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
