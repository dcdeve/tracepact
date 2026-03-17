import type { Message, UsageInfo } from '../driver/types.js';
import type { ToolCallSource } from '../trace/types.js';

export interface Cassette {
  readonly version: number;
  readonly recordedAt: string;
  readonly metadata: CassetteMetadata;
  readonly result: CassetteResult;
}

export interface CassetteMetadata {
  readonly skillHash: string;
  readonly prompt: string;
  readonly promptHash: string;
  readonly toolDefsHash: string;
  readonly provider: string;
  readonly model: string;
  readonly temperature: number;
  readonly frameworkVersion: string;
  readonly driverVersion: string;
}

export interface CassetteResult {
  readonly output: string;
  readonly trace: {
    readonly calls: readonly CassetteToolCall[];
    readonly totalCalls: number;
    readonly totalDurationMs: number;
  };
  readonly messages: readonly Message[];
  readonly usage: UsageInfo;
  readonly duration: number;
}

export interface CassetteToolCall {
  readonly toolName: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly result:
    | { readonly type: 'success'; readonly content: string }
    | { readonly type: 'error'; readonly message: string };
  readonly durationMs: number;
  readonly sequenceIndex: number;
  readonly unknownTool: boolean;
  readonly source?: ToolCallSource;
}

export interface CassetteStub {
  at: {
    sequenceIndex?: number;
    toolName: string;
    args?: Readonly<Record<string, unknown>>;
  };
  return: { type: 'success'; content: string } | { type: 'error'; message: string };
}
