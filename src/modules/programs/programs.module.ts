import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { ProgramsController } from './programs.controller';
import { ProgramDay } from './models/program-day.model';
import { ProgramExercise } from './models/program-exercise.model';
import { Program } from './models/program.model';
import { ProgramsService } from './services/programs.service';

@Module({
  imports: [SequelizeModule.forFeature([Program, ProgramDay, ProgramExercise, Exercise])],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService, SequelizeModule],
})
export class ProgramsModule {}
