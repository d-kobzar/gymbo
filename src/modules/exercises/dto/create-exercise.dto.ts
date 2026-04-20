import { IsString, Length } from 'class-validator';

export class CreateExerciseDto {
  @IsString()
  @Length(1, 100)
  name!: string;
}
