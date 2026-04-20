import { Injectable, OnModuleInit } from '@nestjs/common';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { languageKeyboard } from '../keyboards/language.keyboard';
import { openAppKeyboard } from '../keyboards/settings.keyboard';
import { BotService } from '../services/bot.service';

/**
 * /start — two flows:
 *
 * 1. First-time user: create the row from Telegram metadata, then
 *    ask which language to use. The actual welcome + Open App button
 *    are sent by the callback-query handler once the user picks.
 *    The language prompt is written in all three supported
 *    languages so the user can pick without a pre-set lang.
 *
 * 2. Returning user: send the localized welcome + Open App directly.
 *
 * Using `chatId` instead of Telegram's provisional `language_code`
 * as the trigger lets returning users who already picked Russian
 * skip the prompt.
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
      const { user, created } = await this.botService.findOrCreateUserWithFlag(
        ctx.from,
      );
      await user.update({ chatId: ctx.chat.id });

      if (created) {
        const prompt = [
          'Choose your language:',
          'Оберіть мову:',
          'Выберите язык:',
        ].join('\n');
        await ctx.reply(prompt, { ...languageKeyboard() });
        return;
      }

      const lang = user.language || 'en';
      const appUrl = this.botService.getAppUrl();
      await ctx.reply(this.i18n.t('bot.welcome', lang), {
        ...openAppKeyboard(appUrl, this.i18n.t('bot.openApp', lang)),
      });
    });
  }
}
