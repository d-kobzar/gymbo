import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BotModule } from '@modules/bot/bot.module';
import { User } from '@modules/users/models/user.model';
import { NotificationsController } from './controllers/notifications.controller';
import { MeasurementReminderJob } from './jobs/measurement-reminder.job';
import { TrainingReminderJob } from './jobs/training-reminder.job';
import { WeeklySummaryJob } from './jobs/weekly-summary.job';
import { NotificationSetting } from './models/notification-setting.model';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [SequelizeModule.forFeature([NotificationSetting, User]), BotModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    TrainingReminderJob,
    MeasurementReminderJob,
    WeeklySummaryJob,
  ],
  exports: [NotificationsService, SequelizeModule],
})
export class NotificationsModule {}
