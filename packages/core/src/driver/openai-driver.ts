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

export class OpenAIDriver implements AgentDriver {
  readonly name: string;
  readonly capabilities: DriverCapabilities = {
    seed: true,
    parallelToolCalls: true,
    streaming: true,
    systemPromptRole: true,
    maxContextWindow: 128_000,
  };

  private client: any = null;
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
    this.semaphore = new Semaphore(config.maxConcurrency ?? 5);
  }

  /** @internal — allows injecting a mock client for testing */
  _setClient(mockClient: any): void {
    this.client = mockClient;
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      const { default: OpenAI } = await import('openai');
      const opts: any = { apiKey: this.apiKey };
      if (this.baseURL) {
        opts.baseURL = this.baseURL;
      }
      this.client = new OpenAI(opts);
    }
    return this.client;
  }

  async run(input: RunInput): Promise<RunResult> {
    const client = await this.getClient();
    const startTime = performance.now();
    const temp = input.config?.temperature ?? DEFAULT_TEMPERATURE;
    const maxIter = input.config?.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;

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
        messages.push({ role: msg.role, content: msg.content as string });
      }
    }

    messages.push({ role: 'user', content: input.prompt });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let iterations = 0;
    let finalOutput = '';

    const useStream = input.config?.stream === true;
    const onChunk = input.config?.onChunk;

    while (iterations < maxIter) {
      if (useStream) {
        // Streaming mode
        const result = await this.runStreaming(
          client,
          messages,
          apiTools,
          temp,
          input.config?.maxTokens ?? 4096,
          input.config?.seed,
          onChunk
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

        for (const toolCall of result.toolCalls) {
          const fnName = toolCall.function.name;
          let fnArgs: Record<string, unknown>;
          try {
            fnArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            fnArgs = {};
          }

          const toolResult = await input.sandbox.executeTool(fnName, fnArgs);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult.type === 'success' ? toolResult.content : toolResult.message,
          });
        }
      } else {
        // Non-streaming mode (original)
        const response: any = await this.semaphore.run(() =>
          this.retry.execute(() =>
            client.chat.completions.create({
              model: this.model,
              temperature: temp,
              max_tokens: input.config?.maxTokens ?? 4096,
              seed: input.config?.seed,
              messages,
              tools: apiTools.length > 0 ? apiTools : undefined,
            })
          )
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

        for (const toolCall of msg.tool_calls) {
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

          const result = await input.sandbox.executeTool(fnName, fnArgs);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.type === 'success' ? result.content : result.message,
          });
        }
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
      messages: [],
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        model: this.model,
      },
      duration,
      runManifest: manifest,
    };
  }

  private async runStreaming(
    client: any,
    messages: any[],
    apiTools: any[],
    temperature: number,
    maxTokens: number,
    seed?: number,
    onChunk?: (chunk: string) => void
  ): Promise<{
    content: string;
    toolCalls: any[];
    inputTokens: number;
    outputTokens: number;
  }> {
    const stream: any = await this.semaphore.run(() =>
      this.retry.execute(() =>
        client.chat.completions.create({
          model: this.model,
          temperature,
          max_tokens: maxTokens,
          seed,
          messages,
          tools: apiTools.length > 0 ? apiTools : undefined,
          stream: true,
          stream_options: { include_usage: true },
        })
      )
    );

    let content = '';
    const toolCallMap = new Map<
      number,
      { id: string; function: { name: string; arguments: string } }
    >();
    let inputTokens = 0;
    let outputTokens = 0;

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

    const toolCalls = [...toolCallMap.values()];
    return { content, toolCalls, inputTokens, outputTokens };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const client = await this.getClient();
    const start = performance.now();
    try {
      const response = await client.chat.completions.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return {
        ok: true,
        latencyMs: performance.now() - start,
        model: response.model,
        modelVersion: response.system_fingerprint ?? undefined,
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
