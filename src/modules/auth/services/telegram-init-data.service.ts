import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TelegramConfig } from '@core/config/telegram.config';

const INIT_DATA_TTL_SEC = 24 * 60 * 60; // 24h per Telegram's recommendation

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

/**
 * Verifies Telegram `initData` HMAC signatures and extracts the bundled
 * Telegram user. Kept as its own service so AuthService remains focused
 * on login/JWT concerns.
 */
@Injectable()
export class TelegramInitDataService {
  private readonly botToken: string;

  constructor(config: ConfigService) {
    this.botToken = config.getOrThrow<TelegramConfig>('telegram').botToken;
  }

  verify(initData: string): TelegramUser | null {
    if (!initData || !this.botToken) return null;

    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      if (!hash) return null;
      params.delete('hash');

      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(this.botToken)
        .digest();
      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      if (calculatedHash !== hash) return null;

      const authDate = params.get('auth_date');
      if (authDate) {
        const authTimestamp = parseInt(authDate, 10);
        const now = Math.floor(Date.now() / 1000);
        if (now - authTimestamp > INIT_DATA_TTL_SEC) return null;
      }

      const userParam = params.get('user');
      if (!userParam) return null;

      return JSON.parse(userParam) as TelegramUser;
    } catch {
      return null;
    }
  }
}
