import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@modules/users/services/users.service';
import type { User } from '@modules/users/models/user.model';
import type { TelegramUser } from './telegram-init-data.service';

export interface LoginResult {
  user: User;
  token: string;
}

export const BOT_NOT_STARTED_CODE = 'BOT_NOT_STARTED';

/**
 * Authenticates a Telegram user, but only if they have already
 * registered through the bot (`/start`). Mini App side never
 * creates users — that's the bot's responsibility — otherwise the
 * chatId would be null and notifications wouldn't reach them.
 *
 * Throws ConflictException with code BOT_NOT_STARTED when the user
 * hasn't been registered yet; frontend renders a "tap /start first"
 * screen.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async loginForStartedBot(tgUser: TelegramUser): Promise<LoginResult> {
    const user = await this.usersService.findByTelegramId(tgUser.id);
    if (!user || !user.chatId) {
      throw new ConflictException({
        error: BOT_NOT_STARTED_CODE,
        message: 'Open the bot in Telegram and send /start first.',
      });
    }
    return { user, token: this.signToken(user.id) };
  }

  signToken(userId: number): string {
    return this.jwtService.sign({ sub: userId });
  }
}
