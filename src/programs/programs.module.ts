import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Program } from './program.model';
import { ProgramDay } from './program-day.model';
import { ProgramExercise } from './program-exercise.model';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { ProgramsService } from './programs.service';
import { ProgramsController } from './programs.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Program,
      ProgramDay,
      ProgramExercise,
      Exercise,
    ]),
  ],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
