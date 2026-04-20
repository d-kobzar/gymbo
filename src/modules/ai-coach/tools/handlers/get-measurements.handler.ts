import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import type { CoachTool } from '../coach-tool.interface';

const METRICS = [
  'weight',
  'shoulders',
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
  limit?: number;
}

@Injectable()
export class GetMeasurementsHandler
  implements CoachTool<GetMeasurementsParams, BodyMeasurement[]>
{
  readonly name = 'get_measurements';
  readonly definition = {
    type: 'function' as const,
    function: {
      name: this.name,
      description: 'Get body measurements history, optionally filtered by metric.',
      parameters: {
        type: 'object' as const,
        properties: {
          metric: {
            type: 'string',
            enum: METRICS as unknown as string[],
          },
          limit: { type: 'number', description: 'Max records (default 10)' },
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
    return this.measurementModel.findAll({
      where: { userId },
      order: [['date', 'DESC']],
      limit: params.limit ?? 10,
    });
  }
}
