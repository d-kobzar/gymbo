import { Injectable, OnModuleInit } from '@nestjs/common';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { openAppKeyboard } from '../keyboards/settings.keyboard';
import { BotService } from '../services/bot.service';

/**
 * /start — upserts the user, stores the chatId so notifications can
 * reach them, and sends a welcome with a "Open Mini App" button.
 */
@Injectable()
export class StartUpdate implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    const bot = this.botService.getBot();
    if (!bot) return;

    bot.command('start', async (ctx) => {
      const user = await this.botService.findOrCreateUser(ctx.from);
      await user.update({ chatId: ctx.chat.id });
      const lang = user.language || 'en';
      const appUrl = this.botService.getAppUrl();

      await ctx.reply(this.i18n.t('bot.welcome', lang), {
        ...openAppKeyboard(appUrl, this.i18n.t('bot.openApp', lang)),
      });
    });
  }
}
