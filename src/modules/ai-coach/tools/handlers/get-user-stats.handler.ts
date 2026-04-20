import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import type { CoachTool } from '../coach-tool.interface';

export interface UserStatsResult {
  totalSets: number;
  setsThisWeek: number;
  exerciseCount: number;
  bodyWeight: number | null;
}

@Injectable()
export class GetUserStatsHandler implements CoachTool<Record<string, never>, UserStatsResult> {
  readonly name = 'get_user_stats';
  readonly definition = {
    type: 'function' as const,
    function: {
      name: this.name,
      description: 'Get dashboard stats: sets this week, total sets, body weight, exercise count',
      parameters: { type: 'object' as const, properties: {}, required: [] },
    },
  };

  constructor(
    @InjectModel(TrainingLog) private readonly trainingLogModel: typeof TrainingLog,
    @InjectModel(Exercise) private readonly exerciseModel: typeof Exercise,
    @InjectModel(BodyMeasurement) private readonly measurementModel: typeof BodyMeasurement,
  ) {}

  async execute(_params: Record<string, never>, userId: number): Promise<UserStatsResult> {
    const weekStart = this.weekStart();
    const [totalSets, setsThisWeek, exerciseCount, lastMeasurement] = await Promise.all([
      this.trainingLogModel.count({ where: { userId } }),
      this.trainingLogModel.count({
        where: { userId, createdAt: { [Op.gte]: weekStart } },
      }),
      this.exerciseModel.count({ where: { userId } }),
      this.measurementModel.findOne({
        where: { userId },
        order: [['date', 'DESC']],
      }),
    ]);

    return {
      totalSets,
      setsThisWeek,
      exerciseCount,
      bodyWeight: lastMeasurement?.weight ?? null,
    };
  }

  private weekStart(): Date {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }
}
