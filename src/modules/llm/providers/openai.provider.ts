import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { OpenAIConfig } from '@core/config/openai.config';
import type {
  LlmChatRequest,
  LlmChatResponse,
  LlmFinishReason,
  LlmMessage,
  LlmProvider,
  LlmToolCall,
} from '../llm-provider.interface';

type ResponseInputItem =
  | { type?: 'message'; role: 'user' | 'assistant' | 'system' | 'developer'; content: string }
  | { type: 'function_call'; call_id: string; name: string; arguments: string }
  | { type: 'function_call_output'; call_id: string; output: string };

/**
 * OpenAI adapter. Wraps the Responses API (the Chat Completions API
 * also works but Responses is the current non-deprecated surface and
 * supports first-class tool calls + per-call instructions).
 *
 * Stateless by design — we never set previous_response_id or store:true;
 * the coach module owns the full conversation in CoachMessages.
 */
@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly client: OpenAI | null;

  constructor(config: ConfigService) {
    const cfg = config.getOrThrow<OpenAIConfig>('openai');
    this.client = cfg.apiKey ? new OpenAI({ apiKey: cfg.apiKey }) : null;
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    if (!this.client) throw new Error('OpenAI not configured (OPENAI_API_KEY missing)');

    const input: ResponseInputItem[] = this.toInputItems(request.messages);
    const tools = request.tools?.map((t) => ({
      type: 'function' as const,
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      strict: null,
    }));

    const response = await this.client.responses.create({
      model: request.model,
      instructions: request.instructions,
      input: input as unknown as Parameters<typeof this.client.responses.create>[0]['input'],
      tools,
      max_output_tokens: request.maxOutputTokens,
      temperature: request.temperature,
      store: false,
    });

    return this.fromResponse(response);
  }

  private toInputItems(messages: LlmMessage[]): ResponseInputItem[] {
    const out: ResponseInputItem[] = [];
    for (const msg of messages) {
      if (msg.role === 'user') {
        out.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        if (msg.content) {
          out.push({ role: 'assistant', content: msg.content });
        }
        for (const call of msg.toolCalls ?? []) {
          out.push({
            type: 'function_call',
            call_id: call.id,
            name: call.name,
            arguments: call.arguments,
          });
        }
      } else {
        out.push({
          type: 'function_call_output',
          call_id: msg.toolCallId,
          output: msg.output,
        });
      }
    }
    return out;
  }

  private fromResponse(response: OpenAI.Responses.Response): LlmChatResponse {
    const toolCalls: LlmToolCall[] = [];
    for (const item of response.output ?? []) {
      if (item.type === 'function_call') {
        toolCalls.push({
          id: item.call_id,
          name: item.name,
          arguments: item.arguments,
        });
      }
    }

    const text = response.output_text ?? '';

    const finishReason: LlmFinishReason =
      toolCalls.length > 0
        ? 'tool_calls'
        : response.status === 'incomplete'
          ? 'length'
          : response.status === 'completed'
            ? 'stop'
            : 'other';

    const usage = response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    return { text, toolCalls, usage, finishReason };
  }
}
