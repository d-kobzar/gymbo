import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as cron from 'node-cron';
import { BotService } from '@modules/bot/services/bot.service';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { User } from '@modules/users/models/user.model';
import { NotificationSetting } from '../models/notification-setting.model';

/**
 * Fires every minute and delivers a training reminder to users whose
 * settings match the current UTC hh:mm and weekday.
 *
 * TODO(phase-4): respect per-user timezone instead of UTC.
 */
@Injectable()
export class TrainingReminderJob implements OnModuleInit {
  private readonly logger = new Logger(TrainingReminderJob.name);

  constructor(
    @InjectModel(NotificationSetting)
    private readonly notifModel: typeof NotificationSetting,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly botService: BotService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    if (!this.botService.getBot()) return;
    cron.schedule('* * * * *', () => this.run());
    this.logger.log('Training reminder job scheduled');
  }

  private async run(): Promise<void> {
    try {
      const now = new Date();
      const day = now.getUTCDay();
      const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(
        now.getUTCMinutes(),
      ).padStart(2, '0')}`;

      const settings = await this.notifModel.findAll({
        where: { trainingReminder: true, trainingTime: timeStr },
        include: [{ model: this.userModel, as: 'user' }],
      });

      for (const s of settings) {
        if (!s.user?.chatId || !s.trainingDays?.includes(day)) continue;
        const lang = s.user.language || 'en';
        await this.botService.sendMessage(
          s.user.chatId,
          this.i18n.t('bot.reminderTraining', lang),
        );
      }
    } catch (err) {
      this.logger.error(`Training reminder error: ${(err as Error).message}`);
    }
  }
}
