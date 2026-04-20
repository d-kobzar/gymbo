import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import type { CoachTool } from '../coach-tool.interface';

export interface GetExerciseProgressParams {
  exerciseName: string;
}

export type ExerciseProgressResult =
  | { message: string }
  | Array<Pick<TrainingLog, 'date' | 'setNumber' | 'reps' | 'weight'>>;

@Injectable()
export class GetExerciseProgressHandler
  implements CoachTool<GetExerciseProgressParams, ExerciseProgressResult>
{
  readonly name = 'get_exercise_progress';
  readonly definition = {
    name: this.name,
    description: 'Get progress over time for a specific exercise',
    parameters: {
      type: 'object' as const,
      properties: {
        exerciseName: { type: 'string', description: 'Exercise name' },
      },
      required: ['exerciseName'],
    },
  };

  constructor(
    @InjectModel(TrainingLog) private readonly trainingLogModel: typeof TrainingLog,
    @InjectModel(Exercise) private readonly exerciseModel: typeof Exercise,
  ) {}

  async execute(
    params: GetExerciseProgressParams,
    userId: number,
  ): Promise<ExerciseProgressResult> {
    const ex = await this.exerciseModel.findOne({
      where: { userId, name: { [Op.iLike]: `%${params.exerciseName}%` } },
    });
    if (!ex) return { message: `Exercise "${params.exerciseName}" not found` };

    return this.trainingLogModel.findAll({
      where: { userId, exerciseId: ex.id },
      attributes: ['date', 'setNumber', 'reps', 'weight'],
      order: [
        ['date', 'ASC'],
        ['setNumber', 'ASC'],
      ],
      limit: 100,
    });
  }
}
