import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as cron from 'node-cron';
import { BotService } from '@modules/bot/services/bot.service';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { User } from '@modules/users/models/user.model';
import { NotificationSetting } from '../models/notification-setting.model';

/**
 * Fires every minute and delivers a measurement reminder on the
 * configured weekday + hh:mm. Only one reminder per configured day.
 */
@Injectable()
export class MeasurementReminderJob implements OnModuleInit {
  private readonly logger = new Logger(MeasurementReminderJob.name);

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
    this.logger.log('Measurement reminder job scheduled');
  }

  private async run(): Promise<void> {
    try {
      const now = new Date();
      const day = now.getUTCDay();
      const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(
        now.getUTCMinutes(),
      ).padStart(2, '0')}`;

      const settings = await this.notifModel.findAll({
        where: {
          measurementReminder: true,
          measurementDay: day,
          measurementTime: timeStr,
        },
        include: [{ model: this.userModel, as: 'user' }],
      });

      for (const s of settings) {
        if (!s.user?.chatId) continue;
        const lang = s.user.language || 'en';
        await this.botService.sendMessage(
          s.user.chatId,
          this.i18n.t('bot.reminderMeasurement', lang),
        );
      }
    } catch (err) {
      this.logger.error(`Measurement reminder error: ${(err as Error).message}`);
    }
  }
}
