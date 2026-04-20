import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NotificationSetting } from './notification-setting.model';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NotificationSetting)
    private readonly notificationSettingModel: typeof NotificationSetting,
  ) {}

  async get(userId: number): Promise<NotificationSetting> {
    const [setting] = await this.notificationSettingModel.findOrCreate({
      where: { userId },
      defaults: { userId },
    });
    return setting;
  }

  async update(
    userId: number,
    data: Partial<NotificationSetting>,
  ): Promise<NotificationSetting> {
    const [setting, created] =
      await this.notificationSettingModel.findOrCreate({
        where: { userId },
        defaults: { userId, ...data },
      });

    if (!created) {
      await setting.update(data);
    }

    return setting;
  }
}
