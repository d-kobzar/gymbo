import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ExercisesController } from './exercises.controller';
import { Exercise } from './models/exercise.model';
import { ExercisesService } from './services/exercises.service';

@Module({
  imports: [SequelizeModule.forFeature([Exercise])],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [ExercisesService, SequelizeModule],
})
export class ExercisesModule {}
