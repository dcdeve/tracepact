import type { RunManifest } from '../cache/run-manifest.js';
import type { ParsedSkill } from '../parser/types.js';
import type { MockSandbox } from '../sandbox/mock-sandbox.js';
import type { TypedToolDefinition } from '../tools/types.js';
import type { ToolTrace } from '../trace/types.js';

export interface DriverCapabilities {
  seed: boolean;
  parallelToolCalls: boolean;
  streaming: boolean;
  systemPromptRole: boolean;
  maxContextWindow: number;
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  modelVersion?: string;
  error?: string;
}

export interface AgentDriver {
  readonly name: string;
  readonly capabilities: DriverCapabilities;
  run(input: RunInput): Promise<RunResult>;
  healthCheck(): Promise<HealthCheckResult>;
}

export interface RunInput {
  skill: ParsedSkill | { systemPrompt: string };
  prompt: string;
  tools?: TypedToolDefinition[];
  sandbox: MockSandbox;
  conversation?: Message[];
  config?: RunConfig;
}

export interface RunConfig {
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  timeout?: number;
  maxToolIterations?: number;
  /** Enable streaming for LLM responses (reduces time-to-first-token). */
  stream?: boolean;
  /** Called with each text chunk when streaming is enabled. */
  onChunk?: (chunk: string) => void;
}

export interface RunResult {
  output: string;
  trace: ToolTrace;
  messages: Message[];
  usage: UsageInfo;
  duration: number;
  runManifest: RunManifest;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  model: string;
  modelVersion?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
