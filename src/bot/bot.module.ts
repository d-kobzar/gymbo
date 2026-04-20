import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { BotController } from './bot.controller';
import { SchedulerService } from './scheduler.service';
import { NotificationSetting } from '@modules/notifications/models/notification-setting.model';
import { User } from '@modules/users/models/user.model';
import { AiCoachModule } from '@modules/ai-coach/ai-coach.module';

@Module({
  imports: [
    SequelizeModule.forFeature([User, NotificationSetting]),
    forwardRef(() => AiCoachModule),
  ],
  controllers: [BotController],
  providers: [BotService, BotUpdate, SchedulerService],
  exports: [BotService],
})
export class BotModule {}
