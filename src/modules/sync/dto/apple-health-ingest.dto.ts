import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class HealthSampleDto {
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class HealthWorkoutDto {
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Seconds. */
  @IsOptional()
  @IsNumber()
  duration?: number;

  /** HealthKit workout-activity type label (running, cycling,
   * functional_strength, hiit, yoga, ...). */
  @IsOptional()
  @IsString()
  kind?: string;

  /** Active energy burned, kilocalories. */
  @IsOptional()
  @IsNumber()
  energy?: number;

  /** Covered distance, meters. */
  @IsOptional()
  @IsNumber()
  distance?: number;

  @IsOptional()
  @IsNumber()
  avgHr?: number;

  @IsOptional()
  @IsNumber()
  maxHr?: number;
}

/**
 * Payload the iOS Shortcut POSTs to /api/sync/apple-health/ingest.
 * All arrays optional — the Shortcut only includes metrics the
 * athlete approved via HealthKit permissions. Body-mass samples
 * flow into BodyMeasurement; the rest land in HealthSamples.
 */
export class AppleHealthIngestDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthSampleDto)
  weights?: HealthSampleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthSampleDto)
  sleep?: HealthSampleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthSampleDto)
  restingHr?: HealthSampleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthSampleDto)
  hrv?: HealthSampleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthSampleDto)
  activeEnergy?: HealthSampleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthSampleDto)
  steps?: HealthSampleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthWorkoutDto)
  workouts?: HealthWorkoutDto[];
}
