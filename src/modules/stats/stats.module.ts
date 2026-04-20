import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import { StatsController } from './stats.controller';
import { StatsService } from './services/stats.service';

@Module({
  imports: [SequelizeModule.forFeature([TrainingLog, BodyMeasurement, Exercise])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
