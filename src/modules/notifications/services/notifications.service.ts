import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NotificationSetting } from '../models/notification-setting.model';
import { UpdateNotificationSettingDto } from '../dto/update-notification-setting.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NotificationSetting)
    private readonly notificationSettingModel: typeof NotificationSetting,
  ) {}

  async get(userId: number): Promise<NotificationSetting> {
    const [setting] = await this.notificationSettingModel.findOrCreate({
      where: { userId },
      defaults: { userId } as Partial<NotificationSetting>,
    });
    return setting;
  }

  async update(
    userId: number,
    data: UpdateNotificationSettingDto,
  ): Promise<NotificationSetting> {
    const [setting, created] = await this.notificationSettingModel.findOrCreate({
      where: { userId },
      defaults: { userId, ...data } as Partial<NotificationSetting>,
    });
    if (!created) await setting.update(data);
    return setting;
  }
}
