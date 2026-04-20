import { IsIn, IsOptional } from 'class-validator';

export const PHOTO_LABELS = ['front', 'side', 'back'] as const;
export type PhotoLabel = (typeof PHOTO_LABELS)[number];

export class AddPhotoDto {
  @IsOptional()
  @IsIn(PHOTO_LABELS as unknown as string[])
  label?: PhotoLabel;
}
