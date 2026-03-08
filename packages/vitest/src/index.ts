// Plugin
export { tracepactPlugin } from './plugin.js';

// Run helper
export { runSkill, type RunSkillOptions } from './run-skill.js';

// Test annotations
export { live } from './test-live.js';
export { expensive, cheap } from './annotations.js';

// Reporter
export { TracepactJsonReporter } from './json-reporter.js';

// Token tracking
export { globalTokens, writeTokenReport } from './token-tracker.js';

// Re-export commonly used core types/functions
export {
  createMockTools,
  mockReadFile,
  mockWriteFile,
  captureWrites,
  mockBash,
  denyAll,
  passthrough,
  defineTools,
  parseSkill,
  MockSandbox,
  TraceBuilder,
  connectMcp,
} from '@tracepact/core';

export type {
  ToolTrace,
  ToolCall,
  ToolResult,
  ParsedSkill,
  RunResult,
  MatcherResult,
  TypedToolDefinition,
  WriteCapture,
  McpConnection,
} from '@tracepact/core';
