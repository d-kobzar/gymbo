import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@modules/users/services/users.service';
import type { User } from '@modules/users/models/user.model';
import type { TelegramUser } from './telegram-init-data.service';

export interface LoginResult {
  user: User;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async loginOrRegister(tgUser: TelegramUser): Promise<LoginResult> {
    let user = await this.usersService.findByTelegramId(tgUser.id);

    if (!user) {
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'User';
      user = await this.usersService.create({
        telegramId: tgUser.id,
        name,
        language: tgUser.language_code,
      });
    }

    return { user, token: this.signToken(user.id) };
  }

  signToken(userId: number): string {
    return this.jwtService.sign({ sub: userId });
  }
}
