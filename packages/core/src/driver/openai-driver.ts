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

/** Minimal shape of a non-streaming OpenAI chat completion response used by this driver. */
interface OpenAIChatCompletion {
  model: string;
  system_fingerprint?: string | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  choices: Array<{
    message: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
  }>;
}

/** Minimal shape of a streaming OpenAI chunk used by this driver. */
interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Minimal structural interface for the openai SDK client used by this driver. */
interface OpenAIClient {
  chat: {
    completions: {
      create(params: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>;
    };
  };
}

export class OpenAIDriver implements AgentDriver {
  readonly name: string;
  readonly capabilities: DriverCapabilities = {
    seed: true,
    parallelToolCalls: true,
    streaming: true,
    systemPromptRole: true,
    maxContextWindow: 128_000,
    contentBlockConversation: false,
  };

  private client: OpenAIClient | null = null;
  private apiKey: string;
  private baseURL: string | undefined;
  private model: string;
  private retry: RetryPolicy;
  private semaphore: Semaphore;

  constructor(config: {
    model: string;
    apiKey?: string;
    baseURL?: string;
    providerName?: string;
    maxConcurrency?: number;
    semaphoreTimeoutMs?: number;
    retry?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number };
  }) {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const envHint = config.providerName
        ? `API key not found for provider "${config.providerName}".`
        : 'OPENAI_API_KEY is not set.';
      throw new DriverError(`${envHint} Set it in your environment or in tracepact.config.ts.`);
    }
    this.apiKey = apiKey;
    this.baseURL = config.baseURL;
    this.model = config.model;
    this.name = config.providerName ?? 'openai';
    this.retry = new RetryPolicy(config.retry);
    this.semaphore = new Semaphore(config.maxConcurrency ?? 5, config.semaphoreTimeoutMs);
  }

  /** @internal — allows injecting a mock client for testing */
  _setClient(mockClient: OpenAIClient): void {
    this.client = mockClient;
  }

  private async getClient(): Promise<OpenAIClient> {
    if (!this.client) {
      let OpenAI: any;
      try {
        ({ default: OpenAI } = await import('openai'));
      } catch {
        throw new DriverError('Package openai is not installed. Run: npm install openai');
      }
      const opts: any = { apiKey: this.apiKey };
      if (this.baseURL) {
        opts.baseURL = this.baseURL;
      }
      this.client = new OpenAI(opts) as OpenAIClient;
    }
    return this.client as OpenAIClient;
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
      type: 'function' as const,
      function: {
        name: t.name,
        description: `Tool: ${t.name}`,
        parameters: t.jsonSchema,
      },
    }));

    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    if (input.conversation) {
      for (const msg of input.conversation) {
        if (msg.role === 'system') continue;
        if (Array.isArray(msg.content)) {
          throw new DriverError(
            'OpenAI driver does not support ContentBlock[] in conversation messages ' +
              '(capabilities.contentBlockConversation is false). ' +
              'Only string content is supported. Use AnthropicDriver if you need to resume ' +
              'conversations that contain tool_use/tool_result blocks.'
          );
        }
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
        if (useStream) {
          // Streaming mode
          const streamStart = performance.now();
          const result = await this.runStreaming(
            client,
            messages,
            apiTools,
            temp,
            input.config?.maxTokens ?? 4096,
            input.config?.seed,
            onChunk,
            signal
          );
          log.debug(
            `OpenAIDriver: iteration ${iterations} stream took ${(performance.now() - streamStart).toFixed(1)}ms`
          );

          totalInputTokens += result.inputTokens;
          totalOutputTokens += result.outputTokens;

          if (result.content) {
            finalOutput += result.content;
          }

          if (!result.toolCalls || result.toolCalls.length === 0) {
            break;
          }

          messages.push({
            role: 'assistant',
            content: result.content || null,
            tool_calls: result.toolCalls,
          });

          await this.executeToolCalls(result.toolCalls, input.sandbox, messages);
        } else {
          // Non-streaming mode (original)
          const llmStart = performance.now();
          const response = (await this.semaphore.run(() =>
            this.retry.execute(() =>
              client.chat.completions.create(
                {
                  model: this.model,
                  temperature: temp,
                  max_tokens: input.config?.maxTokens ?? 4096,
                  seed: input.config?.seed,
                  messages,
                  tools: apiTools.length > 0 ? apiTools : undefined,
                },
                signal !== undefined ? { signal } : {}
              )
            )
          )) as OpenAIChatCompletion;
          log.debug(
            `OpenAIDriver: iteration ${iterations} llm call took ${(performance.now() - llmStart).toFixed(1)}ms`
          );

          totalInputTokens += response.usage?.prompt_tokens ?? 0;
          totalOutputTokens += response.usage?.completion_tokens ?? 0;

          const choice = response.choices[0];
          if (!choice) {
            throw new DriverError('OpenAI returned empty choices array.');
          }

          const msg = choice.message;

          if (msg.content) {
            finalOutput += msg.content;
          }

          if (!msg.tool_calls || msg.tool_calls.length === 0) {
            break;
          }

          messages.push(msg);

          await this.executeToolCalls(msg.tool_calls, input.sandbox, messages);
        }

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
      if (input.config?.seed !== undefined) {
        manifestParams.seed = input.config.seed;
      }
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

  private async executeToolCalls(
    toolCalls: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>,
    sandbox: RunInput['sandbox'],
    messages: unknown[]
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      const fnName = toolCall.function.name;
      let fnArgs: Record<string, unknown>;
      try {
        fnArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        fnArgs = {};
        log.warn(
          `OpenAI driver: could not parse tool args for ${fnName}: ${toolCall.function.arguments}`
        );
      }

      const toolStart = performance.now();
      const result = await sandbox.executeTool(fnName, fnArgs);
      log.debug(
        `OpenAIDriver: tool "${fnName}" took ${(performance.now() - toolStart).toFixed(1)}ms`
      );

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result.type === 'success' ? result.content : result.message,
      });
    }
  }

  private async runStreaming(
    client: OpenAIClient,
    messages: unknown[],
    apiTools: unknown[],
    temperature: number,
    maxTokens: number,
    seed?: number,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<{
    content: string;
    toolCalls: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
    inputTokens: number;
    outputTokens: number;
  }> {
    const stream = (await this.semaphore.run(() =>
      this.retry.execute(() =>
        client.chat.completions.create(
          {
            model: this.model,
            temperature,
            max_tokens: maxTokens,
            seed,
            messages,
            tools: apiTools.length > 0 ? apiTools : undefined,
            stream: true,
            stream_options: { include_usage: true },
          },
          signal !== undefined ? { signal } : {}
        )
      )
    )) as AsyncIterable<OpenAIStreamChunk>;

    let content = '';
    const toolCallMap = new Map<
      number,
      { id: string; type: 'function'; function: { name: string; arguments: string } }
    >();
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;

        if (delta?.content) {
          content += delta.content;
          if (onChunk) onChunk(delta.content);
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallMap.has(idx)) {
              toolCallMap.set(idx, {
                id: tc.id ?? '',
                type: 'function' as const,
                function: { name: tc.function?.name ?? '', arguments: '' },
              });
            }
            const existing = toolCallMap.get(idx);
            if (!existing) continue;
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.function.name = tc.function.name;
            if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
          }
        }

        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
        }
      }
    } catch (streamErr: any) {
      log.warn(
        `OpenAIDriver: stream interrupted. contentBytes=${content.length}, toolCallsInProgress=${toolCallMap.size}, Error: ${streamErr?.message ?? streamErr}`
      );
      throw streamErr;
    }

    const toolCalls = [...toolCallMap.values()];
    return { content, toolCalls, inputTokens, outputTokens };
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
        client.chat.completions.create({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        timeout,
      ]).finally(() => clearTimeout(timeoutHandle))) as OpenAIChatCompletion;
      const modelVersion = response.system_fingerprint ?? undefined;
      return {
        ok: true,
        latencyMs: performance.now() - start,
        model: response.model,
        ...(modelVersion !== undefined ? { modelVersion } : {}),
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
