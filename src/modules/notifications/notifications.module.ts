import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationSetting } from './models/notification-setting.model';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [SequelizeModule.forFeature([NotificationSetting])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService, SequelizeModule],
})
export class NotificationsModule {}
