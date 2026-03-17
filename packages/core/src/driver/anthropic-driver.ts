import { computeManifest } from '../cache/run-manifest.js';
import { DEFAULT_MAX_TOOL_ITERATIONS, DEFAULT_TEMPERATURE } from '../config/defaults.js';
import { DriverError } from '../errors/driver-error.js';
import { log } from '../logger.js';
import { RetryPolicy } from './retry-policy.js';
import { Semaphore } from './semaphore.js';
import type {
  AgentDriver,
  DriverCapabilities,
  HealthCheckResult,
  RunInput,
  RunResult,
} from './types.js';

/** Minimal shape of a non-streaming Anthropic messages response used by this driver. */
interface AnthropicMessagesResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string | null;
}

/** Minimal shape of a streaming Anthropic event used by this driver. */
interface AnthropicStreamEvent {
  type: string;
  message?: { usage?: { input_tokens?: number } };
  usage?: { output_tokens?: number };
  content_block?: { type?: string; id?: string; name?: string };
  delta?: { type?: string; text?: string; partial_json?: string };
}

/** Accumulator for a single tool_use block assembled from stream events. */
interface ToolUseAccumulator {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Minimal structural interface for the @anthropic-ai/sdk client used by this driver. */
interface AnthropicClient {
  messages: {
    create(params: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>;
  };
}

export class AnthropicDriver implements AgentDriver {
  readonly name: string;
  readonly capabilities: DriverCapabilities = {
    seed: false,
    parallelToolCalls: true,
    streaming: true,
    systemPromptRole: true,
    maxContextWindow: 200_000,
    contentBlockConversation: true,
  };

  private client: AnthropicClient | null = null;
  private apiKey: string;
  private model: string;
  private retry: RetryPolicy;
  private semaphore: Semaphore;

  constructor(config: {
    model: string;
    apiKey?: string;
    providerName?: string;
    maxConcurrency?: number;
    retry?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number };
  }) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new DriverError(
        'ANTHROPIC_API_KEY is not set. Set it in your environment or in tracepact.config.ts.'
      );
    }
    this.apiKey = apiKey;
    this.model = config.model;
    this.name = config.providerName ?? 'anthropic';
    this.retry = new RetryPolicy(config.retry);
    this.semaphore = new Semaphore(config.maxConcurrency ?? 5);
  }

  /** @internal — allows injecting a mock client for testing */
  _setClient(mockClient: AnthropicClient): void {
    this.client = mockClient;
  }

  private async getClient(): Promise<AnthropicClient> {
    if (!this.client) {
      // Dynamic import — @anthropic-ai/sdk is an optional peer dependency
      let mod: any;
      try {
        // @ts-ignore — optional peer dep, may not be installed
        mod = await import('@anthropic-ai/sdk');
      } catch {
        throw new DriverError(
          'Package @anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk'
        );
      }
      const Anthropic = mod.default ?? mod.Anthropic;
      this.client = new Anthropic({ apiKey: this.apiKey }) as AnthropicClient;
    }
    return this.client as AnthropicClient;
  }

  async run(input: RunInput): Promise<RunResult> {
    if (!input.skill) {
      throw new DriverError(
        'RunInput.skill is required. Pass a ParsedSkill (from parseSkill()) or { systemPrompt: "..." }.'
      );
    }
    if (input.config?.stream === true && !this.capabilities.streaming) {
      throw new DriverError(
        `Driver "${this.name}" does not support streaming. Remove stream: true from RunConfig.`
      );
    }

    const client = await this.getClient();
    const startTime = performance.now();
    const temp = input.config?.temperature ?? DEFAULT_TEMPERATURE;
    const maxIter = input.config?.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
    const maxTokens = input.config?.maxTokens ?? 4096;
    const timeoutMs = input.config?.timeout;

    let abortController: AbortController | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs !== undefined) {
      abortController = new AbortController();
      timeoutHandle = setTimeout(() => abortController?.abort(), timeoutMs);
    }
    const signal = abortController?.signal;

    const systemPrompt = 'hash' in input.skill ? input.skill.body : input.skill.systemPrompt;

    const apiTools = (input.tools ?? []).map((t) => ({
      name: t.name,
      description: `Tool: ${t.name}`,
      input_schema: t.jsonSchema,
    }));

    const messages: any[] = [];

    if (input.conversation) {
      for (const msg of input.conversation) {
        if (msg.role === 'system') continue;
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: input.prompt });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let iterations = 0;
    let finalOutput = '';

    const useStream = input.config?.stream === true;
    const onChunk = input.config?.onChunk;

    try {
      while (iterations < maxIter) {
        const requestParams: any = {
          model: this.model,
          max_tokens: maxTokens,
          temperature: temp,
          system: systemPrompt,
          messages,
        };
        if (apiTools.length > 0) {
          requestParams.tools = apiTools;
        }

        const textBlocks: string[] = [];
        const toolUseBlocks: ToolUseAccumulator[] = [];

        if (useStream) {
          requestParams.stream = true;
          const streamStart = performance.now();
          const stream = (await this.semaphore.run(() =>
            this.retry.execute(() =>
              client.messages.create(requestParams, signal !== undefined ? { signal } : {})
            )
          )) as AsyncIterable<AnthropicStreamEvent>;
          log.debug(
            `AnthropicDriver: iteration ${iterations} stream opened in ${(performance.now() - streamStart).toFixed(1)}ms`
          );

          let currentToolUse: ToolUseAccumulator | null = null;
          let currentToolJson = '';

          try {
            for await (const event of stream) {
              if (event.type === 'message_start' && event.message?.usage) {
                totalInputTokens += event.message.usage.input_tokens ?? 0;
              }
              if (event.type === 'message_delta' && event.usage) {
                totalOutputTokens += event.usage.output_tokens ?? 0;
              }
              if (event.type === 'content_block_start') {
                if (event.content_block?.type === 'tool_use') {
                  currentToolUse = {
                    id: event.content_block.id ?? '',
                    name: event.content_block.name ?? '',
                    input: {},
                  };
                  currentToolJson = '';
                }
              }
              if (event.type === 'content_block_delta') {
                if (event.delta?.type === 'text_delta') {
                  textBlocks.push(event.delta.text ?? '');
                  if (onChunk) onChunk(event.delta.text ?? '');
                }
                if (event.delta?.type === 'input_json_delta' && currentToolUse) {
                  currentToolJson += event.delta.partial_json ?? '';
                }
              }
              if (event.type === 'content_block_stop' && currentToolUse) {
                try {
                  currentToolUse.input = JSON.parse(currentToolJson || '{}') as Record<
                    string,
                    unknown
                  >;
                } catch {
                  log.warn(
                    `AnthropicDriver: could not parse tool args for ${currentToolUse.name}: ${currentToolJson}`
                  );
                  currentToolUse.input = {};
                }
                toolUseBlocks.push(currentToolUse);
                currentToolUse = null;
                currentToolJson = '';
              }
            }
          } catch (streamErr: any) {
            log.warn(
              `AnthropicDriver: stream interrupted at iteration ${iterations}. ` +
                `textBlocks=${textBlocks.length}, toolUseBlocks=${toolUseBlocks.length}, ` +
                `inProgressTool=${currentToolUse?.name ?? 'none'}, ` +
                `partialJsonBytes=${currentToolJson.length}. ` +
                `Error: ${streamErr?.message ?? streamErr}`
            );
            throw streamErr;
          }
        } else {
          const llmStart = performance.now();
          const response = (await this.semaphore.run(() =>
            this.retry.execute(() =>
              client.messages.create(requestParams, signal !== undefined ? { signal } : {})
            )
          )) as AnthropicMessagesResponse;
          log.debug(
            `AnthropicDriver: iteration ${iterations} llm call took ${(performance.now() - llmStart).toFixed(1)}ms`
          );

          totalInputTokens += response.usage?.input_tokens ?? 0;
          totalOutputTokens += response.usage?.output_tokens ?? 0;

          for (const block of response.content) {
            if (block.type === 'text') {
              textBlocks.push(block.text ?? '');
            } else if (block.type === 'tool_use') {
              toolUseBlocks.push({
                id: block.id ?? '',
                name: block.name ?? '',
                input: (block.input as Record<string, unknown>) ?? {},
              });
            }
          }
        }

        if (textBlocks.length > 0) {
          finalOutput += textBlocks.join('');
        }

        if (toolUseBlocks.length === 0) {
          break;
        }

        // Add assistant message with content blocks
        const assistantContent: any[] = [];
        if (textBlocks.length > 0) {
          assistantContent.push({ type: 'text', text: textBlocks.join('') });
        }
        for (const tu of toolUseBlocks) {
          assistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
        }
        messages.push({ role: 'assistant', content: assistantContent });

        // Process each tool use and build tool results
        const toolResults: any[] = [];
        for (const toolUse of toolUseBlocks) {
          const fnName: string = toolUse.name;
          const fnArgs: Record<string, unknown> = toolUse.input ?? {};

          const toolStart = performance.now();
          const result = await input.sandbox.executeTool(fnName, fnArgs);
          log.debug(
            `AnthropicDriver: iteration ${iterations} tool "${fnName}" took ${(performance.now() - toolStart).toFixed(1)}ms`
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result.type === 'success' ? result.content : result.message,
            is_error: result.type === 'error',
          });
        }

        messages.push({ role: 'user', content: toolResults });
        iterations++;
      }

      if (iterations >= maxIter) {
        throw new DriverError(`Agent exceeded max tool iterations (${maxIter}).`);
      }

      const duration = performance.now() - startTime;
      const trace = input.sandbox.getTrace();

      const manifestParams: Parameters<typeof computeManifest>[0] = {
        skill: input.skill,
        prompt: input.prompt,
        tools: input.tools ?? [],
        provider: this.name,
        model: this.model,
        temperature: temp,
        frameworkVersion: '__VERSION__',
        driverVersion: '__VERSION__',
      };
      const manifest = computeManifest(manifestParams);

      return {
        output: finalOutput,
        trace,
        messages: messages as import('./types.js').Message[],
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          model: this.model,
        },
        duration,
        runManifest: manifest,
        cacheStatus: 'miss',
      };
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        throw new DriverError(`Run timed out after ${timeoutMs}ms.`);
      }
      throw err;
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const client = await this.getClient();
    const start = performance.now();
    const HEALTH_CHECK_TIMEOUT_MS = 5_000;
    try {
      let timeoutHandle: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`healthCheck timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`)),
          HEALTH_CHECK_TIMEOUT_MS
        );
      });
      const response = (await Promise.race([
        client.messages.create({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        timeout,
      ]).finally(() => clearTimeout(timeoutHandle))) as AnthropicMessagesResponse;
      return {
        ok: true,
        latencyMs: performance.now() - start,
        model: response.model,
        modelVersion: response.id,
      };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: performance.now() - start,
        model: this.model,
        error: err.message,
      };
    }
  }
}
