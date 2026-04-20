import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cron from 'node-cron';
import { InjectModel } from '@nestjs/sequelize';
import { NotificationSetting } from '../notifications/notification-setting.model';
import { User } from '../users/user.model';
import { BotService } from './bot.service';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectModel(NotificationSetting) private notifModel: typeof NotificationSetting,
    @InjectModel(User) private userModel: typeof User,
    private botService: BotService,
    private i18n: I18nService,
  ) {}

  onModuleInit() {
    if (!this.botService.getBot()) {
      this.logger.warn('Bot not initialized — scheduler disabled');
      return;
    }

    // Training reminders — every minute
    cron.schedule('* * * * *', () => this.checkTrainingReminders());

    // Measurement reminders — every minute
    cron.schedule('* * * * *', () => this.checkMeasurementReminders());

    // Weekly summary — Sundays at 10:00 UTC
    cron.schedule('0 10 * * 0', () => this.sendWeeklySummaries());

    this.logger.log('Notification scheduler started');
  }

  private async checkTrainingReminders() {
    try {
      const now = new Date();
      const h = now.getUTCHours();
      const m = now.getUTCMinutes();
      const day = now.getUTCDay();
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const settings = await this.notifModel.findAll({
        where: { trainingReminder: true, trainingTime: timeStr },
        include: [{ model: this.userModel, as: 'user' }],
      });

      for (const s of settings) {
        if (!s.user?.chatId || !s.trainingDays?.includes(day)) continue;
        const lang = s.user.language || 'en';
        await this.botService.sendMessage(s.user.chatId, this.i18n.t('bot.reminderTraining', lang));
      }
    } catch (err) {
      this.logger.error(`Training reminder error: ${(err as Error).message}`);
    }
  }

  private async checkMeasurementReminders() {
    try {
      const now = new Date();
      const h = now.getUTCHours();
      const m = now.getUTCMinutes();
      const day = now.getUTCDay();
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const settings = await this.notifModel.findAll({
        where: { measurementReminder: true, measurementDay: day, measurementTime: timeStr },
        include: [{ model: this.userModel, as: 'user' }],
      });

      for (const s of settings) {
        if (!s.user?.chatId) continue;
        const lang = s.user.language || 'en';
        await this.botService.sendMessage(s.user.chatId, this.i18n.t('bot.reminderMeasurement', lang));
      }
    } catch (err) {
      this.logger.error(`Measurement reminder error: ${(err as Error).message}`);
    }
  }

  private async sendWeeklySummaries() {
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
