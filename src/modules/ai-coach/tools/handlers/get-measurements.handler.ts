import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import type { CoachTool } from '../coach-tool.interface';

const METRICS = [
  'weight',
  'shoulders',
  'neck',
  'arm',
  'chest',
  'waist',
  'abs',
  'glutes',
  'thigh',
  'calf',
] as const;

export interface GetMeasurementsParams {
  metric?: (typeof METRICS)[number];
  since?: string;
  until?: string;
  limit?: number;
}

@Injectable()
export class GetMeasurementsHandler
  implements CoachTool<GetMeasurementsParams, BodyMeasurement[]>
{
  readonly name = 'get_measurements';
  readonly definition = {
    name: this.name,
    description:
      'Fetch body-measurement entries over a date range. Use this when the athlete asks about bodyweight / circumferences this week, last month, or a specific past entry. Combine `since` + `until` for a range; filter by `metric` to pull a single field.',
    parameters: {
      type: 'object' as const,
      properties: {
        metric: {
          type: 'string',
          enum: METRICS as unknown as string[],
          description:
            'Single metric to extract (weight / shoulders / neck / arm / chest / waist / abs / glutes / thigh / calf). Omit to return all fields per row.',
        },
        since: {
          type: 'string',
          description: 'Lower bound, inclusive (YYYY-MM-DD).',
        },
        until: {
          type: 'string',
          description: 'Upper bound, inclusive (YYYY-MM-DD).',
        },
        limit: {
          type: 'number',
          description: 'Max records returned (default 30).',
        },
      },
    },
  };

  constructor(
    @InjectModel(BodyMeasurement) private readonly measurementModel: typeof BodyMeasurement,
  ) {}

  async execute(
    params: GetMeasurementsParams,
    userId: number,
  ): Promise<BodyMeasurement[]> {
    const where: WhereOptions<BodyMeasurement> = { userId };
    if (params.since || params.until) {
      const range: Record<symbol, string> = {};
      if (params.since) range[Op.gte] = params.since;
      if (params.until) range[Op.lte] = params.until;
      (where as Record<string, unknown>).date = range;
    }
    return this.measurementModel.findAll({
      where,
      order: [['date', 'DESC']],
      limit: params.limit ?? 30,
    });
  }
}
