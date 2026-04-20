import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { Public } from '@shared/decorators/public.decorator';
import { TelegramLoginDto } from './dto/login.dto';
import { AuthService, LoginResult } from './services/auth.service';
import { TelegramInitDataService } from './services/telegram-init-data.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly initData: TelegramInitDataService,
  ) {}

  @Public()
  @Post('telegram')
  async telegramLogin(@Body() body: TelegramLoginDto): Promise<LoginResult> {
    const tgUser = this.initData.verify(body.initData);
    if (!tgUser) throw new UnauthorizedException('Invalid Telegram init data');
    return this.authService.loginOrRegister(tgUser);
  }
}
