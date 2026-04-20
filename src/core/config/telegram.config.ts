import { registerAs } from '@nestjs/config';

export interface TelegramConfig {
  botToken: string;
  webhookSecret: string;
  appUrl: string;
}

export const telegramConfig = registerAs('telegram', (): TelegramConfig => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  appUrl: process.env.APP_URL ?? '',
}));
