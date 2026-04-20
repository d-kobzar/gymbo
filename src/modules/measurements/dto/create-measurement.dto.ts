import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateMeasurementDto {
  @IsDateString()
  date!: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500) weight?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(300) shoulders?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(300) arm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(300) chest?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(300) waist?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(300) abs?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(300) glutes?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(300) thigh?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(300) calf?: number;
}
