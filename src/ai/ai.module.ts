import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiService } from './ai.service';
import { AiThread } from './ai-thread.model';

@Module({
  imports: [SequelizeModule.forFeature([AiThread])],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
