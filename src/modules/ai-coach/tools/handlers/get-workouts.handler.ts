import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import type { CoachTool } from '../coach-tool.interface';

export interface GetWorkoutsParams {
  date?: string;
  since?: string;
  until?: string;
  exerciseName?: string;
  limit?: number;
}

@Injectable()
export class GetWorkoutsHandler implements CoachTool<GetWorkoutsParams, TrainingLog[]> {
  readonly name = 'get_workouts';
  readonly definition = {
    name: this.name,
    description:
      'Fetch workout logs over a date range. Use this when the athlete asks about a specific past session or a period (this week, last month, a specific weekday). Combine `since` and `until` for a range; use `date` for a single day. If no filter is passed, returns the last 20 sets across all time.',
    parameters: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Single calendar day (YYYY-MM-DD).',
        },
        since: {
          type: 'string',
          description:
            'Lower bound, inclusive (YYYY-MM-DD). Use with `until` for a range, or alone for "from X onwards".',
        },
        until: {
          type: 'string',
          description: 'Upper bound, inclusive (YYYY-MM-DD).',
        },
        exerciseName: {
          type: 'string',
          description: 'Filter by exercise name (case-insensitive substring match).',
        },
        limit: {
          type: 'number',
          description: 'Max records returned (default 100). Raise when pulling a full week / month.',
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

    if (params.date) {
      where.date = params.date;
    } else if (params.since || params.until) {
      const range: Record<symbol, string> = {};
      if (params.since) range[Op.gte] = params.since;
      if (params.until) range[Op.lte] = params.until;
      (where as Record<string, unknown>).date = range;
    }

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
      limit: params.limit ?? 100,
    });
  }
}
