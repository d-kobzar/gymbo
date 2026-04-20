import { IsString, Length } from 'class-validator';

export class UpdateExerciseDto {
  @IsString()
  @Length(1, 100)
  name!: string;
}
