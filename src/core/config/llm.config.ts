import { registerAs } from '@nestjs/config';

export type LlmProviderName = 'openai';

export interface LlmConfig {
  provider: LlmProviderName;
  model: string;
  maxOutputTokens: number;
  debounceMs: number;
  summaryRegenThreshold: number;
  messageGcDays: number;
}

export const llmConfig = registerAs('llm', (): LlmConfig => ({
  provider: (process.env.LLM_PROVIDER ?? 'openai') as LlmProviderName,
  model: process.env.LLM_MODEL ?? 'gpt-4o',
  maxOutputTokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 2000),
  debounceMs: Number(process.env.LLM_DEBOUNCE_MS ?? 15000),
  summaryRegenThreshold: Number(process.env.LLM_SUMMARY_REGEN_THRESHOLD ?? 20),
  messageGcDays: Number(process.env.LLM_MESSAGE_GC_DAYS ?? 7),
}));
