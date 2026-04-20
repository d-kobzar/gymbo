import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { TelegramConfig } from '@core/config/telegram.config';

/**
 * Verifies the `X-Telegram-Bot-Api-Secret-Token` header against the
 * configured webhook secret. Applied to the bot-webhook route so
 * un-signed POSTs never reach Telegraf's handler.
 *
 * Skipped silently if no secret is configured (dev-mode polling).
 */
@Injectable()
export class TelegramWebhookGuard implements CanActivate {
  private readonly expectedSecret: string;

  constructor(config: ConfigService) {
    this.expectedSecret = config.getOrThrow<TelegramConfig>('telegram').webhookSecret;
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.expectedSecret) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-telegram-bot-api-secret-token'];
    if (provided !== this.expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    return true;
  }
}
