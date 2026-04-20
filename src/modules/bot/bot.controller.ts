import {
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BotService } from './services/bot.service';

// TODO(phase-4): move the secret-token check behind TelegramWebhookGuard.
@Controller()
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(private readonly botService: BotService) {}

  @Post('bot/webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Res() res: Response) {
    const bot = this.botService.getBot();
    if (!bot) return res.status(200).send('ok');

    const secret = req.headers['x-telegram-bot-api-secret-token'];
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected && secret !== expected) {
      return res.status(403).send('forbidden');
    }

    try {
      await bot.handleUpdate(req.body);
    } catch (err) {
      this.logger.error(`Webhook handler error: ${(err as Error).message}`);
    }
    return res.status(200).send('ok');
  }
}
