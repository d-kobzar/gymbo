import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import type { CoachTool } from '../coach-tool.interface';

export interface GetWorkoutsParams {
  date?: string;
  exerciseName?: string;
  limit?: number;
}

@Injectable()
export class GetWorkoutsHandler implements CoachTool<GetWorkoutsParams, TrainingLog[]> {
  readonly name = 'get_workouts';
  readonly definition = {
    type: 'function' as const,
    function: {
      name: this.name,
      description: 'Get recent workout logs. Optionally filter by date or exercise name.',
      parameters: {
        type: 'object' as const,
        properties: {
          date: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
          exerciseName: { type: 'string', description: 'Filter by exercise name' },
          limit: { type: 'number', description: 'Max records (default 20)' },
        },
      },
    },
  };

  constructor(
    @InjectModel(TrainingLog) private readonly trainingLogModel: typeof TrainingLog,
    @InjectModel(Exercise) private readonly exerciseModel: typeof Exercise,
  ) {}

  async execute(params: GetWorkoutsParams, userId: number): Promise<TrainingLog[]> {
    const where: WhereOptions<TrainingLog> = { userId };
    if (params.date) where.date = params.date;

    if (params.exerciseName) {
      const ex = await this.exerciseModel.findOne({
        where: { userId, name: { [Op.iLike]: `%${params.exerciseName}%` } },
      });
      if (ex) where.exerciseId = ex.id;
    }

    return this.trainingLogModel.findAll({
      where,
      include: [{ model: Exercise, attributes: ['name'] }],
      order: [
        ['date', 'DESC'],
        ['setNumber', 'ASC'],
      ],
      limit: params.limit ?? 20,
    });
  }
}
