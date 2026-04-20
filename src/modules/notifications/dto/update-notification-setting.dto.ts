import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateNotificationSettingDto {
  @IsOptional() @IsBoolean() trainingReminder?: boolean;

  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'trainingTime must be HH:MM (24h)' })
  trainingTime?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  trainingDays?: number[];

  @IsOptional() @IsBoolean() measurementReminder?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(6) measurementDay?: number;

  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'measurementTime must be HH:MM (24h)' })
  measurementTime?: string;

  @IsOptional() @IsBoolean() weeklySummary?: boolean;
}
