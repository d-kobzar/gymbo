import { IsIn } from 'class-validator';

export const MEASUREMENT_METRICS = [
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

export type MeasurementMetric = (typeof MEASUREMENT_METRICS)[number];

export class ProgressQueryDto {
  @IsIn(MEASUREMENT_METRICS as unknown as string[])
  metric!: MeasurementMetric;
}
