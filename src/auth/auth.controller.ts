import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  async telegramLogin(@Body('initData') initData: string) {
    const tgUser = this.authService.validateTelegramInitData(initData);
    if (!tgUser) {
      throw new UnauthorizedException('Invalid Telegram init data');
    }
    return this.authService.loginOrRegister(tgUser);
  }
}
