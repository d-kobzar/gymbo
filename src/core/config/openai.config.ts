import { registerAs } from '@nestjs/config';

export interface OpenAIConfig {
  apiKey: string;
  runTokenBudget: number;
}

export const openaiConfig = registerAs('openai', (): OpenAIConfig => ({
  apiKey: process.env.OPENAI_API_KEY ?? '',
  runTokenBudget: Number(process.env.OPENAI_RUN_TOKEN_BUDGET ?? 8000),
}));
