import { IsIn } from 'class-validator';

const LANGS = ['en', 'ua', 'ru'] as const;

export class UpdateLanguageDto {
  @IsIn(LANGS as unknown as string[])
  language!: (typeof LANGS)[number];
}
