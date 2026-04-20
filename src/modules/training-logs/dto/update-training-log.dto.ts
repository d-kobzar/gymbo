import { PartialType } from '@nestjs/mapped-types';
import { CreateTrainingLogDto } from './create-training-log.dto';

export class UpdateTrainingLogDto extends PartialType(CreateTrainingLogDto) {}
