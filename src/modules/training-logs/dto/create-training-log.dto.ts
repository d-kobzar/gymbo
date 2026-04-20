import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateTrainingLogDto {
  @IsDateString()
  date!: string;

  @IsInt()
  @Min(1)
  exerciseId!: number;

  @IsInt()
  @Min(1)
  setNumber!: number;

  @IsInt()
  @Min(0)
  @Max(1000)
  reps!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  @Type(() => Number)
  weight!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  rir?: number;
}
