import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import type { CoachTool } from '../coach-tool.interface';

export interface PrRecord {
  maxWeight: number;
  maxReps: number;
  maxVolume: number;
}

@Injectable()
export class GetPersonalRecordsHandler
  implements CoachTool<Record<string, never>, Record<string, PrRecord>>
{
  readonly name = 'get_personal_records';
  readonly definition = {
    type: 'function' as const,
    function: {
      name: this.name,
      description: 'Get personal records (max weight, reps, volume) per exercise',
      parameters: { type: 'object' as const, properties: {}, required: [] },
    },
  };

  constructor(
    @InjectModel(TrainingLog) private readonly trainingLogModel: typeof TrainingLog,
  ) {}

  async execute(
    _params: Record<string, never>,
    userId: number,
  ): Promise<Record<string, PrRecord>> {
    const logs = await this.trainingLogModel.findAll({
      where: { userId },
      include: [{ model: Exercise, attributes: ['name'] }],
      attributes: ['exerciseId', 'reps', 'weight'],
    });

    const prs: Record<string, PrRecord> = {};
    for (const log of logs) {
      const name = log.exercise?.name ?? `#${log.exerciseId}`;
      if (!prs[name]) prs[name] = { maxWeight: 0, maxReps: 0, maxVolume: 0 };
      const weight = Number(log.weight);
      prs[name].maxWeight = Math.max(prs[name].maxWeight, weight);
      prs[name].maxReps = Math.max(prs[name].maxReps, log.reps);
      prs[name].maxVolume = Math.max(prs[name].maxVolume, log.reps * weight);
    }
    return prs;
  }
}
