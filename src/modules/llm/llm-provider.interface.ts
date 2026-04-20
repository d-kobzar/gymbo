/**
 * Provider-agnostic LLM surface. Adapters for OpenAI / Anthropic /
 * Gemini / self-hosted translate to this shape so the coach module
 * never imports an SDK directly.
 */

export type LlmRole = 'user' | 'assistant' | 'tool';

export interface LlmUserMessage {
  role: 'user';
  content: string;
}

export interface LlmAssistantMessage {
  role: 'assistant';
  content: string;
  toolCalls?: LlmToolCall[];
}

export interface LlmToolResultMessage {
  role: 'tool';
  toolCallId: string;
  output: string;
}

export type LlmMessage = LlmUserMessage | LlmAssistantMessage | LlmToolResultMessage;

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LlmFunctionTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type LlmFinishReason = 'stop' | 'tool_calls' | 'length' | 'other';

export interface LlmChatRequest {
  model: string;
  instructions: string;
  messages: LlmMessage[];
  tools?: LlmFunctionTool[];
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LlmChatResponse {
  text: string;
  toolCalls: LlmToolCall[];
  usage?: LlmUsage;
  finishReason: LlmFinishReason;
}

export interface LlmProvider {
  readonly name: string;
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
