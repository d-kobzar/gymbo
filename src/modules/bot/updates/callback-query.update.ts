import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { User } from '@modules/users/models/user.model';
import { BotService } from '../services/bot.service';

/**
 * Inline callback_query handling. Currently one pattern — language
 * selection `lang:xx` — with room to grow as new inline keyboards
 * land.
 */
@Injectable()
export class CallbackQueryUpdate implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly i18n: I18nService,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  onModuleInit(): void {
    const bot = this.botService.getBot();
    if (!bot) return;

    bot.action(/^lang:(.+)$/, async (ctx) => {
      const lang = ctx.match[1];
      const user = await this.userModel.findOne({
        where: { telegramId: ctx.from.id },
      });
      if (user) await user.update({ language: lang });
      await ctx.answerCbQuery(this.i18n.t('bot.settingsSaved', lang));
      await ctx.editMessageText(`${this.i18n.t('bot.chooseLanguage', lang)} ✓`);
    });
  }
}
