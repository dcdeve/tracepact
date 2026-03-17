import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import type {
  LanguageModelV3Content,
  LanguageModelV3GenerateResult,
  LanguageModelV3Prompt,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { CassettePlayer, CassetteRecorder } from '@tracepact/core';
import type { Cassette, Message, ObservedMetadata, RunResult } from '@tracepact/core';
import { contentToAssistantMessage, promptToMessages, toUsageInfo } from './adapter.js';
import type { Tracker } from './tracker.js';

export type CassetteMode = 'auto' | 'record' | 'replay';

export interface CassetteBridgeOptions {
  filePath: string;
  mode: CassetteMode;
}

type ResolvedMode = 'record' | 'replay';

/**
 * Manages cassette record/replay for the wrapper.
 *
 * - record: saves a cassette after the run completes (finishReason 'stop')
 * - replay: returns pre-recorded doGenerate responses from the cassette
 */
export class CassetteBridge {
  private resolvedMode: ResolvedMode | undefined;
  private recorder: CassetteRecorder | undefined;
  private replayTurns: LanguageModelV3GenerateResult[] | undefined;
  private replayIndex = 0;
  private readonly sessionId = randomUUID();
  private readonly startTime = Date.now();

  constructor(private readonly options: CassetteBridgeOptions) {}

  /**
   * Initialize the bridge. Must be called before use.
   * Determines whether to record or replay based on mode and file existence.
   */
  async init(): Promise<ResolvedMode> {
    if (this.options.mode === 'record') {
      this.recorder = new CassetteRecorder(this.options.filePath);
      this.resolvedMode = 'record';
      return 'record';
    }

    if (this.options.mode === 'replay') {
      await this.loadReplayTurns();
      this.resolvedMode = 'replay';
      return 'replay';
    }

    // auto: replay if file exists, record otherwise
    try {
      await access(this.options.filePath);
      await this.loadReplayTurns();
      this.resolvedMode = 'replay';
      return 'replay';
    } catch {
      this.recorder = new CassetteRecorder(this.options.filePath);
      this.resolvedMode = 'record';
      return 'record';
    }
  }

  isReplay(): boolean {
    return this.resolvedMode === 'replay';
  }

  /**
   * Get the next pre-recorded doGenerate response for replay mode.
   */
  getReplayTurn(): LanguageModelV3GenerateResult {
    if (!this.replayTurns) {
      throw new Error('CassetteBridge: replay turns not loaded');
    }
    if (this.replayIndex >= this.replayTurns.length) {
      throw new Error(
        `CassetteBridge: replay exhausted — cassette has ${this.replayTurns.length} turns, ` +
          `but doGenerate was called ${this.replayIndex + 1} times`
      );
    }
    const turn = this.replayTurns[this.replayIndex++];
    if (!turn) {
      throw new Error('CassetteBridge: unexpected missing turn');
    }
    return turn;
  }

  /**
   * Save the cassette after a successful run (record mode).
   */
  async saveRecord(
    tracker: Tracker,
    lastPrompt: LanguageModelV3Prompt,
    lastContent: LanguageModelV3Content[],
    modelId: string
  ): Promise<void> {
    if (!this.recorder) return;

    const messages: Message[] = [
      ...promptToMessages(lastPrompt),
      contentToAssistantMessage(lastContent),
    ];

    const { trace, output } = tracker.getResult();
    const usage = toUsageInfo(tracker.getUsage(), modelId);

    const result: RunResult = {
      output,
      trace,
      messages,
      usage,
      duration: Date.now() - this.startTime,
      cacheStatus: 'skipped',
    };

    const metadata: ObservedMetadata = {
      source: 'observed',
      sessionId: this.sessionId,
    };

    await this.recorder.save(result, metadata);
  }

  /**
   * Load a cassette and split its messages into doGenerate-shaped turns.
   */
  private async loadReplayTurns(): Promise<void> {
    const player = new CassettePlayer(this.options.filePath);
    const cassette = await player.load();
    this.replayTurns = cassetteTurns(cassette);
  }
}

/**
 * Split a cassette's messages into individual doGenerate responses.
 *
 * Each assistant message becomes one turn. Tool_use blocks → tool-call content,
 * text blocks → text content. The last turn gets finishReason 'stop',
 * all others get 'tool-calls'.
 */
function cassetteTurns(cassette: Cassette): LanguageModelV3GenerateResult[] {
  const turns: LanguageModelV3GenerateResult[] = [];
  const assistantMessages = cassette.result.messages.filter((m) => m.role === 'assistant');

  const perTurnUsage = splitUsage(cassette.result.usage, assistantMessages.length);

  for (const [i, msg] of assistantMessages.entries()) {
    const isLast = i === assistantMessages.length - 1;
    const content = messageToV3Content(msg);

    const hasToolCalls = content.some((c) => c.type === 'tool-call');
    const finishReason =
      isLast && !hasToolCalls
        ? { unified: 'stop' as const, raw: undefined }
        : { unified: 'tool-calls' as const, raw: undefined };

    turns.push({
      content,
      finishReason,
      usage: perTurnUsage,
      warnings: [],
    });
  }

  return turns;
}

function messageToV3Content(msg: Message): LanguageModelV3GenerateResult['content'] {
  if (typeof msg.content === 'string') {
    return [{ type: 'text', text: msg.content }];
  }

  return msg.content.map((block): LanguageModelV3GenerateResult['content'][number] => {
    switch (block.type) {
      case 'text':
        return { type: 'text', text: block.text };
      case 'tool_use':
        return {
          type: 'tool-call',
          toolCallId: block.id,
          toolName: block.name,
          input: JSON.stringify(block.input),
        };
      case 'tool_result':
        // Tool results in assistant messages are unusual; skip as text
        return { type: 'text', text: '' };
    }
  });
}

function splitUsage(
  usage: { inputTokens: number; outputTokens: number },
  turns: number
): LanguageModelV3Usage {
  const perTurn = turns > 0 ? Math.ceil(usage.inputTokens / turns) : 0;
  const perTurnOutput = turns > 0 ? Math.ceil(usage.outputTokens / turns) : 0;
  return {
    inputTokens: {
      total: perTurn,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: perTurnOutput, text: undefined, reasoning: undefined },
  };
}
