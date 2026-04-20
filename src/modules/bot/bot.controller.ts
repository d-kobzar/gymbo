import {
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TelegramWebhookGuard } from '@shared/guards/telegram-webhook.guard';
import { Raw } from '@shared/decorators/raw-response.decorator';
import { BotService } from './services/bot.service';

@Controller()
@UseGuards(TelegramWebhookGuard)
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(private readonly botService: BotService) {}

  @Post('bot/webhook')
  @HttpCode(200)
  @Raw()
  async webhook(@Req() req: Request, @Res() res: Response) {
    const bot = this.botService.getBot();
    if (!bot) return res.status(200).send('ok');
    try {
      await bot.handleUpdate(req.body);
    } catch (err) {
      this.logger.error(`Webhook handler error: ${(err as Error).message}`);
    }
    return res.status(200).send('ok');
  }
}
