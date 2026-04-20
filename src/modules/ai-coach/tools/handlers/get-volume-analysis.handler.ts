import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import type { CoachTool } from '../coach-tool.interface';

export interface GetVolumeAnalysisParams {
  weeks?: number;
}

export interface VolumeByExercise {
  name: string;
  totalVolume: number;
}

@Injectable()
export class GetVolumeAnalysisHandler
  implements CoachTool<GetVolumeAnalysisParams, VolumeByExercise[]>
{
  readonly name = 'get_volume_analysis';
  readonly definition = {
    type: 'function' as const,
    function: {
      name: this.name,
      description: 'Get volume analysis by exercise for last N weeks',
      parameters: {
        type: 'object' as const,
        properties: {
          weeks: { type: 'number', description: 'Weeks to analyze (default 4)' },
        },
      },
    },
  };

  constructor(
    @InjectModel(TrainingLog) private readonly trainingLogModel: typeof TrainingLog,
  ) {}

  async execute(
    params: GetVolumeAnalysisParams,
    userId: number,
  ): Promise<VolumeByExercise[]> {
    const weeks = params.weeks ?? 4;
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const logs = await this.trainingLogModel.findAll({
      where: { userId, date: { [Op.gte]: since } },
      include: [{ model: Exercise, attributes: ['name'] }],
    });

    const volume: Record<string, number> = {};
    for (const log of logs) {
      const name = log.exercise?.name ?? `#${log.exerciseId}`;
      volume[name] = (volume[name] ?? 0) + log.reps * Number(log.weight);
    }

    return Object.entries(volume)
      .sort(([, a], [, b]) => b - a)
      .map(([name, totalVolume]) => ({ name, totalVolume }));
  }
}
