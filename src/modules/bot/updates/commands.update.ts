import { Injectable, OnModuleInit } from '@nestjs/common';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { languageKeyboard } from '../keyboards/language.keyboard';
import { BotService } from '../services/bot.service';

/**
 * /stats, /settings, /coach — simple commands that reply with a
 * localized message. No business logic beyond i18n lookup and
 * optional keyboard attachment.
 */
@Injectable()
export class CommandsUpdate implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    const bot = this.botService.getBot();
    if (!bot) return;

    bot.command('stats', async (ctx) => {
      const user = await this.botService.findOrCreateUser(ctx.from);
      await ctx.reply(this.i18n.t('bot.noData', user.language || 'en'));
    });

    bot.command('settings', async (ctx) => {
      const user = await this.botService.findOrCreateUser(ctx.from);
      const lang = user.language || 'en';
      await ctx.reply(this.i18n.t('bot.chooseLanguage', lang), {
        ...languageKeyboard(),
      });
    });

    bot.command('coach', async (ctx) => {
      const user = await this.botService.findOrCreateUser(ctx.from);
      await ctx.reply(this.i18n.t('coach.welcome', user.language || 'en'));
    });
  }
}
