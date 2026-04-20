import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  validateTelegramInitData(initData: string): TelegramUser | null {
    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      if (!hash) return null;

      params.delete('hash');

      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) return null;

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
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
        if (now - authTimestamp > 86400) return null;
      }

      const userParam = params.get('user');
      if (!userParam) return null;

      return JSON.parse(userParam) as TelegramUser;
    } catch {
      return null;
    }
  }

  async loginOrRegister(
    tgUser: TelegramUser,
  ): Promise<{ user: any; token: string }> {
    let user = await this.usersService.findByTelegramId(tgUser.id);

    if (!user) {
      const name = [tgUser.first_name, tgUser.last_name]
        .filter(Boolean)
        .join(' ');

      user = await this.usersService.create({
        telegramId: tgUser.id,
        name,
        language: tgUser.language_code,
      });
    }

    const token = this.signToken(user.id);
    return { user, token };
  }

  signToken(userId: number): string {
    return this.jwtService.sign({ sub: userId });
  }
}
