import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as cron from 'node-cron';
import { BotService } from '@modules/bot/services/bot.service';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { User } from '@modules/users/models/user.model';
import { NotificationSetting } from '../models/notification-setting.model';

/**
 * Sends a weekly summary on Sundays at 10:00 UTC to users who have
 * `weeklySummary` enabled. The actual per-user totals are still a
 * TODO — the job currently sends the template with em-dashes.
 */
@Injectable()
export class WeeklySummaryJob implements OnModuleInit {
  private readonly logger = new Logger(WeeklySummaryJob.name);

  constructor(
    @InjectModel(NotificationSetting)
    private readonly notifModel: typeof NotificationSetting,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly botService: BotService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    if (!this.botService.getBot()) return;
    cron.schedule('0 10 * * 0', () => this.run());
    this.logger.log('Weekly summary job scheduled');
  }

  private async run(): Promise<void> {
    try {
      const settings = await this.notifModel.findAll({
        where: { weeklySummary: true },
        include: [{ model: this.userModel, as: 'user' }],
      });

      for (const s of settings) {
        if (!s.user?.chatId) continue;
        const lang = s.user.language || 'en';
        await this.botService.sendMessage(
          s.user.chatId,
          this.i18n.t('bot.weeklySummary', lang, { sets: '—', days: '—' }),
        );
      }
    } catch (err) {
      this.logger.error(`Weekly summary error: ${(err as Error).message}`);
    }
  }
}
