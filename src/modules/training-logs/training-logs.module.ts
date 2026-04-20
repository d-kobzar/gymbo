import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TrainingLogsController } from './training-logs.controller';
import { TrainingLog } from './models/training-log.model';
import { TrainingLogsService } from './services/training-logs.service';

@Module({
  imports: [SequelizeModule.forFeature([TrainingLog])],
  controllers: [TrainingLogsController],
  providers: [TrainingLogsService],
  exports: [TrainingLogsService, SequelizeModule],
})
export class TrainingLogsModule {}
