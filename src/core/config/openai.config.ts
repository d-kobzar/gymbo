import { registerAs } from '@nestjs/config';

export interface OpenAIConfig {
  apiKey: string;
}

export const openaiConfig = registerAs('openai', (): OpenAIConfig => ({
  apiKey: process.env.OPENAI_API_KEY ?? '',
}));
