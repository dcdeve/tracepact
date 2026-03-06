import { computeManifest } from '../cache/run-manifest.js';
import { DEFAULT_MAX_TOOL_ITERATIONS, DEFAULT_TEMPERATURE } from '../config/defaults.js';
import { DriverError } from '../errors/driver-error.js';
import { RetryPolicy } from './retry-policy.js';
import { Semaphore } from './semaphore.js';
import type {
  AgentDriver,
  DriverCapabilities,
  HealthCheckResult,
  RunInput,
  RunResult,
} from './types.js';

export class AnthropicDriver implements AgentDriver {
  readonly name: string;
  readonly capabilities: DriverCapabilities = {
    seed: false,
    parallelToolCalls: true,
    streaming: true,
    systemPromptRole: true,
    maxContextWindow: 200_000,
  };

  private client: any = null;
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
  _setClient(mockClient: any): void {
    this.client = mockClient;
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      // Dynamic import — @anthropic-ai/sdk is an optional peer dependency
      // @ts-ignore — optional peer dep, may not be installed
      const mod: any = await import('@anthropic-ai/sdk');
      const Anthropic = mod.default ?? mod.Anthropic;
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async run(input: RunInput): Promise<RunResult> {
    if (!input.skill) {
      throw new DriverError(
        'RunInput.skill is required. Pass a ParsedSkill (from parseSkill()) or { systemPrompt: "..." }.'
      );
    }

    const client = await this.getClient();
    const startTime = performance.now();
    const temp = input.config?.temperature ?? DEFAULT_TEMPERATURE;
    const maxIter = input.config?.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
    const maxTokens = input.config?.maxTokens ?? 4096;

    const systemPrompt = 'hash' in input.skill ? input.skill.body : input.skill.systemPrompt;

    const apiTools = (input.tools ?? []).map((t) => ({
      name: t.name,
      description: `Tool: ${t.name}`,
      input_schema: t.jsonSchema,
    }));

    const messages: any[] = [];

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
      const toolUseBlocks: any[] = [];

      if (useStream) {
        requestParams.stream = true;
        const stream: any = await this.semaphore.run(() =>
          this.retry.execute(() => client.messages.create(requestParams))
        );

        let currentToolUse: any = null;
        let currentToolJson = '';

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
                id: event.content_block.id,
                name: event.content_block.name,
                input: {},
              };
              currentToolJson = '';
            }
          }
          if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta') {
              textBlocks.push(event.delta.text);
              if (onChunk) onChunk(event.delta.text);
            }
            if (event.delta?.type === 'input_json_delta' && currentToolUse) {
              currentToolJson += event.delta.partial_json;
            }
          }
          if (event.type === 'content_block_stop' && currentToolUse) {
            try {
              currentToolUse.input = JSON.parse(currentToolJson || '{}');
            } catch {
              currentToolUse.input = {};
            }
            toolUseBlocks.push(currentToolUse);
            currentToolUse = null;
            currentToolJson = '';
          }
        }
      } else {
        const response: any = await this.semaphore.run(() =>
          this.retry.execute(() => client.messages.create(requestParams))
        );

        totalInputTokens += response.usage?.input_tokens ?? 0;
        totalOutputTokens += response.usage?.output_tokens ?? 0;

        for (const block of response.content) {
          if (block.type === 'text') {
            textBlocks.push(block.text);
          } else if (block.type === 'tool_use') {
            toolUseBlocks.push(block);
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

        const result = await input.sandbox.executeTool(fnName, fnArgs);

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

  async healthCheck(): Promise<HealthCheckResult> {
    const client = await this.getClient();
    const start = performance.now();
    try {
      const response = await client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
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
