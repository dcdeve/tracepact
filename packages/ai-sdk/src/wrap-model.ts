import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3Prompt,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import type { ToolTrace } from '@tracepact/core';
import { CassetteBridge, type CassetteMode } from './cassette.js';
import { Tracker } from './tracker.js';

export interface WrapModelOptions {
  /** Path to the cassette file. If omitted, observe-only mode (no record/replay). */
  cassette?: string;
  /** Explicit mode. Default: 'auto' (replay if cassette exists, record otherwise). */
  mode?: CassetteMode;
}

export interface WrapModelReturn {
  /**
   * The wrapped LanguageModelV3 — pass this to generateText / streamText.
   *
   * **streamText**: delegates to the inner model but tool calls in the stream
   * are NOT tracked (tracking is planned for step 7). Throws in replay mode
   * because there is no real provider to stream from.
   */
  model: LanguageModelV3;
  /** Get the ToolTrace after the run completes. */
  getTrace(): ToolTrace;
  /** Get trace + output after the run completes. Needed for toMatchTrajectory. */
  getResult(): { trace: ToolTrace; output: string };
}

export function wrapModel(
  innerModel: LanguageModelV3,
  options?: WrapModelOptions
): WrapModelReturn {
  const tracker = new Tracker();
  let bridge: CassetteBridge | undefined;
  let bridgeReady: Promise<void> | undefined;
  let lastPrompt: LanguageModelV3Prompt = [];
  let lastContent: LanguageModelV3GenerateResult['content'] = [];

  if (options?.cassette) {
    bridge = new CassetteBridge({
      filePath: options.cassette,
      mode: options.mode ?? 'auto',
    });
    bridgeReady = bridge.init().then(() => undefined);
  }

  const model: LanguageModelV3 = {
    specificationVersion: 'v3',
    provider: innerModel.provider,
    modelId: innerModel.modelId,
    supportedUrls: innerModel.supportedUrls,

    async doGenerate(
      callOptions: LanguageModelV3CallOptions
    ): Promise<LanguageModelV3GenerateResult> {
      // Ensure cassette bridge is initialized
      if (bridgeReady) await bridgeReady;

      tracker.beforeGenerate(callOptions);
      lastPrompt = callOptions.prompt;

      let result: LanguageModelV3GenerateResult;

      if (bridge?.isReplay()) {
        result = bridge.getReplayTurn();
      } else {
        result = await innerModel.doGenerate(callOptions);
      }

      tracker.afterGenerate(result);
      lastContent = result.content;

      // Save cassette on terminal response (record mode)
      if (result.finishReason.unified === 'stop' && bridge && !bridge.isReplay()) {
        await bridge.saveRecord(tracker, lastPrompt, lastContent, innerModel.modelId);
      }

      return result;
    },

    async doStream(callOptions: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
      if (bridgeReady) await bridgeReady;

      if (bridge?.isReplay()) {
        throw new Error(
          '@tracepact/ai-sdk: doStream is not supported in replay mode. Use generateText instead of streamText.'
        );
      }

      // Streaming tracking is not yet implemented (plan step 7).
      // In record/observe-only mode, the stream delegates directly — tool calls
      // in the stream will NOT be tracked.
      return innerModel.doStream(callOptions);
    },
  };

  return {
    model,
    getTrace: () => tracker.getTrace(),
    getResult: () => tracker.getResult(),
  };
}
