import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const GOALS = ['hypertrophy', 'strength', 'cut', 'maintenance'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machines',
  'bodyweight',
  'cables',
] as const;
const SEXES = ['male', 'female'] as const;

export class InitialMeasurementDto {
  @IsNumber() @Min(20) @Max(400) weight!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) shoulders?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) neck?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) arm?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) chest?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) waist?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) abs?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) glutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) thigh?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) calf?: number;
}

export class OnboardingProfileDto {
  @IsIn(SEXES as unknown as string[])
  sex!: 'male' | 'female';

  /** ISO date (YYYY-MM-DD) — we store the raw string to avoid TZ drift. */
  @IsDateString()
  dateOfBirth!: string;

  @IsNumber()
  @Min(80)
  @Max(260)
  heightCm!: number;

  @IsIn(GOALS as unknown as string[])
  goal!: (typeof GOALS)[number];

  @IsIn(LEVELS as unknown as string[])
  experienceLevel!: (typeof LEVELS)[number];

  @IsInt()
  @Min(1)
  @Max(7)
  trainingDaysPerWeek!: number;

  @IsArray()
  @ArrayMaxSize(5)
  @IsIn(EQUIPMENT as unknown as string[], { each: true })
  equipment!: Array<(typeof EQUIPMENT)[number]>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  injuries?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  healthNotes?: string;
}

export class OnboardingDto {
  @ValidateNested()
  @Type(() => OnboardingProfileDto)
  profile!: OnboardingProfileDto;

  @ValidateNested()
  @Type(() => InitialMeasurementDto)
  measurement!: InitialMeasurementDto;
}
