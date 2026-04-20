import { Injectable, OnModuleInit } from '@nestjs/common';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { languageKeyboard } from '../keyboards/language.keyboard';
import { openAppKeyboard } from '../keyboards/settings.keyboard';
import { BotService } from '../services/bot.service';

/**
 * /start — two flows:
 *
 * 1. Not-yet-onboarded user (no onboardedAt): ask which language to
 *    use. The actual welcome + Open App button are sent by the
 *    callback-query handler once the user picks. The prompt is
 *    written in all three supported languages so the user can pick
 *    without a pre-set lang. We key off `onboardedAt` rather than
 *    "row just created" because every /start ping we already got
 *    during testing created a row — returning pre-onboarding users
 *    should still see the prompt.
 *
 * 2. Onboarded user: send the localized welcome + Open App directly.
 *    Language is stable at this point (changeable via /settings).
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

      if (!user.onboardedAt) {
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
