import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProgramExerciseDto {
  @IsInt()
  @Min(1)
  exerciseId!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  sets!: number;
}

export class ProgramDayDto {
  @IsString()
  @Length(1, 20)
  day!: string;

  @IsBoolean()
  isRest!: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramExerciseDto)
  exercises?: ProgramExerciseDto[];
}

export class CreateProgramDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => ProgramDayDto)
  days!: ProgramDayDto[];
}
