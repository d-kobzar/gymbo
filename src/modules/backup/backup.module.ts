import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { MeasurementPhoto } from '@modules/measurements/models/measurement-photo.model';
import { ProgramDay } from '@modules/programs/models/program-day.model';
import { ProgramExercise } from '@modules/programs/models/program-exercise.model';
import { Program } from '@modules/programs/models/program.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import { BackupController } from './backup.controller';
import { BackupService } from './services/backup.service';

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
