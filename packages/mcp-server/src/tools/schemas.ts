import { z } from 'zod';

export const runSchema = {
  skill_path: z.string().describe('Path to the SKILL.md or directory containing tracepact tests'),
  live: z
    .boolean()
    .optional()
    .describe('Run against real LLM APIs instead of mock mode (default: false)'),
  provider: z
    .string()
    .optional()
    .describe('LLM provider to use (e.g. openai, groq, deepseek). Defaults to config.'),
  budget: z.number().optional().describe('Maximum live tokens. Suite aborts if exceeded.'),
};

export const captureSchema = {
  skill_path: z.string().describe('Path to the SKILL.md file'),
  prompt: z
    .string()
    .describe(
      'Representative prompt to send to the agent — used to infer assertions from the resulting trace'
    ),
};

export const auditSchema = {
  skill_path: z
    .string()
    .describe(
      'Path to the SKILL.md file to audit. Runs 4 static analysis rules: tool-combo-risk, prompt-hygiene, skill-completeness, no-opaque-tools.'
    ),
};

export const diffSchema = {
  cassette_a: z.string().describe('Path to the baseline cassette file (before change)'),
  cassette_b: z.string().describe('Path to the comparison cassette file (after change)'),
};

export const listTestsSchema = {
  skill_path: z
    .string()
    .describe(
      'Path to the SKILL.md file. Searches the same directory for .test.ts, .tracepact.ts files and cassette JSON files.'
    ),
};

export const replaySchema = {
  cassette_path: z
    .string()
    .describe(
      'Path to the cassette JSON file to replay. Returns the full trace without calling any API.'
    ),
};
