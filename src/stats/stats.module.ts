import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TrainingLog } from '../training-logs/training-log.model';
import { BodyMeasurement } from '../measurements/body-measurement.model';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([TrainingLog, BodyMeasurement, Exercise]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
