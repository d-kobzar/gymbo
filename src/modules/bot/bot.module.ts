import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiCoachModule } from '@modules/ai-coach/ai-coach.module';
import { User } from '@modules/users/models/user.model';
import { BotController } from './bot.controller';
import { BotService } from './services/bot.service';
import { CallbackQueryUpdate } from './updates/callback-query.update';
import { CommandsUpdate } from './updates/commands.update';
import { StartUpdate } from './updates/start.update';
import { TextMessageUpdate } from './updates/text-message.update';

@Module({
  imports: [
    SequelizeModule.forFeature([User]),
    forwardRef(() => AiCoachModule),
  ],
  controllers: [BotController],
  providers: [
    BotService,
    // Registration order matters — command handlers must register
    // before the catch-all text handler so /start etc. resolve first.
    StartUpdate,
    CommandsUpdate,
    CallbackQueryUpdate,
    TextMessageUpdate,
  ],
  exports: [BotService],
})
export class BotModule {}
