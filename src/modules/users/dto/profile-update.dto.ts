import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { InitialMeasurementDto, OnboardingProfileDto } from './onboarding.dto';

/**
 * Same shape as OnboardingDto but with measurement optional — the
 * edit flow reuses the questionnaire form to update the profile and
 * optionally record a fresh body measurement.
 */
export class ProfileUpdateDto {
  @ValidateNested()
  @Type(() => OnboardingProfileDto)
  profile!: OnboardingProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InitialMeasurementDto)
  measurement?: InitialMeasurementDto;
}
