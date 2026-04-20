import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { BotController } from './bot.controller';
import { SchedulerService } from './scheduler.service';
import { NotificationSetting } from '../notifications/notification-setting.model';
import { User } from '../users/user.model';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    SequelizeModule.forFeature([User, NotificationSetting]),
    forwardRef(() => AiModule),
  ],
  controllers: [BotController],
  providers: [BotService, BotUpdate, SchedulerService],
  exports: [BotService],
})
export class BotModule {}
