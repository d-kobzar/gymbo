import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CoachService } from '@modules/ai-coach/services/coach.service';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { User } from '@modules/users/models/user.model';
import { BotService } from '../services/bot.service';

/**
 * Free-text messages — routed to the AI coach. Any text that isn't
 * a command falls through to here, so this handler must sit last
 * among Telegraf's middleware chain (Telegraf preserves registration
 * order, and BotModule declares this update after the command
 * updates).
 */
@Injectable()
export class TextMessageUpdate implements OnModuleInit {
  private readonly logger = new Logger(TextMessageUpdate.name);

  constructor(
    private readonly botService: BotService,
    private readonly i18n: I18nService,
    @Inject(forwardRef(() => CoachService))
    private readonly coachService: CoachService,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  onModuleInit(): void {
    const bot = this.botService.getBot();
    if (!bot) return;

    bot.on('text', async (ctx) => {
      let user = await this.userModel.findOne({ where: { telegramId: ctx.from.id } });
      if (!user) {
        user = await this.botService.findOrCreateUser(ctx.from);
        await user.update({ chatId: ctx.chat.id });
      }
      const lang = user.language || 'en';

      try {
        await ctx.sendChatAction('typing');
        const reply = await this.coachService.chat(user.id, ctx.message.text);
        await this.botService.sendFormatted(ctx, reply);
      } catch (err) {
        this.logger.error(`Coach chat error: ${(err as Error).message ?? err}`);
        await ctx.reply(this.i18n.t('coach.error', lang));
      }
    });
  }
}
