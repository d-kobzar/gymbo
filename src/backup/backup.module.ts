import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { TrainingLog } from '../training-logs/training-log.model';
import { BodyMeasurement } from '../measurements/body-measurement.model';
import { MeasurementPhoto } from '../measurements/measurement-photo.model';
import { Program } from '../programs/program.model';
import { ProgramDay } from '../programs/program-day.model';
import { ProgramExercise } from '../programs/program-exercise.model';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Exercise,
      TrainingLog,
      BodyMeasurement,
      MeasurementPhoto,
      Program,
      ProgramDay,
      ProgramExercise,
    ]),
  ],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
