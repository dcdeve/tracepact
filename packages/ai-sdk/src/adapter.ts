import type {
  LanguageModelV3Content,
  LanguageModelV3Prompt,
  LanguageModelV3ToolResultOutput,
} from '@ai-sdk/provider';
import type { ContentBlock, Message, UsageInfo } from '@tracepact/core';

/**
 * Convert a LanguageModelV3Prompt to tracepact Message[].
 *
 * Mappings:
 * - system  → { role: 'system', content: string }
 * - user    → { role: 'user', content: ContentBlock[] } (text parts only)
 * - assistant → { role: 'assistant', content: ContentBlock[] } (text + tool_use)
 * - tool    → { role: 'user', content: ContentBlock[] } (tool_result blocks)
 */
export function promptToMessages(prompt: LanguageModelV3Prompt): Message[] {
  const messages: Message[] = [];

  for (const msg of prompt) {
    switch (msg.role) {
      case 'system':
        messages.push({ role: 'system', content: msg.content });
        break;

      case 'user': {
        const blocks: ContentBlock[] = [];
        for (const part of msg.content) {
          if (part.type === 'text') {
            blocks.push({ type: 'text', text: part.text });
          }
          // FileParts are skipped — not representable in tracepact's ContentBlock
        }
        if (blocks.length > 0) {
          messages.push({ role: 'user', content: blocks });
        }
        break;
      }

      case 'assistant': {
        const blocks: ContentBlock[] = [];
        for (const part of msg.content) {
          if (part.type === 'text') {
            blocks.push({ type: 'text', text: part.text });
          } else if (part.type === 'tool-call') {
            let input: Record<string, unknown>;
            if (typeof part.input === 'object' && part.input !== null) {
              input = part.input as Record<string, unknown>;
            } else if (typeof part.input === 'string') {
              try {
                const parsed = JSON.parse(part.input);
                input = typeof parsed === 'object' && parsed !== null ? parsed : {};
              } catch {
                input = {};
              }
            } else {
              input = {};
            }
            blocks.push({
              type: 'tool_use',
              id: part.toolCallId,
              name: part.toolName,
              input,
            });
          }
          // ReasoningPart, FilePart, ToolResultPart — skipped
        }
        if (blocks.length > 0) {
          messages.push({ role: 'assistant', content: blocks });
        }
        break;
      }

      case 'tool': {
        const blocks: ContentBlock[] = [];
        for (const part of msg.content) {
          if (part.type === 'tool-result') {
            blocks.push({
              type: 'tool_result',
              tool_use_id: part.toolCallId,
              content: toolResultOutputToString(part.output),
              is_error: isErrorOutput(part.output),
            });
          }
          // ToolApprovalResponsePart — skipped
        }
        if (blocks.length > 0) {
          messages.push({ role: 'user', content: blocks });
        }
        break;
      }
    }
  }

  return messages;
}

/**
 * Build a tracepact assistant Message from LanguageModelV3 response content.
 */
export function contentToAssistantMessage(content: LanguageModelV3Content[]): Message {
  const blocks: ContentBlock[] = [];

  for (const part of content) {
    if (part.type === 'text') {
      blocks.push({ type: 'text', text: part.text });
    } else if (part.type === 'tool-call') {
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(part.input) as Record<string, unknown>;
      } catch {
        input = {};
      }
      blocks.push({
        type: 'tool_use',
        id: part.toolCallId,
        name: part.toolName,
        input,
      });
    }
  }

  return {
    role: 'assistant',
    content: blocks.length === 1 && blocks[0]?.type === 'text' ? blocks[0]?.text : blocks,
  };
}

/**
 * Convert accumulated token counts + modelId to tracepact UsageInfo.
 */
export function toUsageInfo(
  usage: { inputTokens: number; outputTokens: number },
  modelId: string
): UsageInfo {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    model: modelId,
  };
}

/**
 * Serialize a LanguageModelV3ToolResultOutput to a string for tracepact's ContentBlock.
 */
export function toolResultOutputToString(output: LanguageModelV3ToolResultOutput): string {
  switch (output.type) {
    case 'text':
      return output.value;
    case 'json':
      return JSON.stringify(output.value);
    case 'content':
      return output.value
        .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join('');
    case 'error-text':
      return output.value;
    case 'error-json':
      return JSON.stringify(output.value);
    case 'execution-denied':
      return output.reason ?? 'execution denied';
  }
}

/**
 * Check if a LanguageModelV3ToolResultOutput represents an error.
 */
export function isErrorOutput(output: LanguageModelV3ToolResultOutput): boolean {
  return (
    output.type === 'error-text' ||
    output.type === 'error-json' ||
    output.type === 'execution-denied'
  );
}
