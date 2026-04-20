import { Controller, Post, Req, Res, HttpCode, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { BotService } from './bot.service';

@Controller()
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(private botService: BotService) {}

  @Post('bot/webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Res() res: Response) {
    const bot = this.botService.getBot();
    if (!bot) {
      return res.status(200).send('ok');
    }

    // Verify secret token
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
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
