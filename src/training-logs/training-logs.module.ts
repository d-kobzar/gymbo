import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TrainingLog } from './training-log.model';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { TrainingLogsService } from './training-logs.service';
import { TrainingLogsController } from './training-logs.controller';

@Module({
  imports: [SequelizeModule.forFeature([TrainingLog, Exercise])],
  controllers: [TrainingLogsController],
  providers: [TrainingLogsService],
  exports: [TrainingLogsService],
})
export class TrainingLogsModule {}
