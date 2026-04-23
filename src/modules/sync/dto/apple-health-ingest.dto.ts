import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsDefined,
  IsNumber,
  IsObject,
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
 * Inner payload — the actual health arrays. Wrapped in an outer
 * { data: ... } envelope (see AppleHealthIngestDto below) to
 * stay consistent with the rest of our API surface.
 *
 * All arrays optional — the Shortcut only includes metrics the
 * athlete approved via HealthKit permissions. Scalar metrics land
 * in HealthSamples, workouts in ActivitySamples.
 *
 * Note: bodyweight is intentionally NOT pulled from HealthKit —
 * the athlete logs it manually in the Mini App measurement flow,
 * pulling again from Apple would cause dupe rows and last-writer-
 * wins races across the two entry paths.
 */
export class AppleHealthIngestData {
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

/**
 * Envelope the iOS Shortcut POSTs to /api/sync/apple-health/ingest.
 * Top-level shape: { data: { sleep: [...], steps: [...], ... } }.
 */
export class AppleHealthIngestDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => AppleHealthIngestData)
  data!: AppleHealthIngestData;
}
