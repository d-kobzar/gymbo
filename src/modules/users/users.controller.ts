import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CoachContext } from '@modules/ai-coach/models/coach-context.model';
import { CoachService } from '@modules/ai-coach/services/coach.service';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { OnboardingDto } from './dto/onboarding.dto';
import { ProfileUpdateDto } from './dto/profile-update.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { User } from './models/user.model';
import { OnboardingService } from './services/onboarding.service';

/**
 * Endpoints: /me (boot info), /onboarding (first-run submit),
 * /profile (post-onboarding edits). The "me" payload powers the
 * onboarding gate on the client and the "Edit profile" form seed.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(CoachContext)
    private readonly contextModel: typeof CoachContext,
    @InjectModel(BodyMeasurement)
    private readonly measurementModel: typeof BodyMeasurement,
    private readonly onboarding: OnboardingService,
    private readonly coach: CoachService,
  ) {}

  @Get('me')
  async me(@CurrentUser('id') userId: number) {
    const user = await this.userModel.findByPk(userId);
    if (!user) return { id: null };
    const [ctx, latestMeasurement] = await Promise.all([
      this.contextModel.findOne({ where: { userId } }),
      this.measurementModel.findOne({
        where: { userId },
        order: [['date', 'DESC']],
      }),
    ]);
    return {
      id: user.id,
      telegramId: user.telegramId,
      name: user.name,
      language: user.language,
      timezone: user.timezone,
      onboardedAt: user.onboardedAt,
      profile: ctx?.profile ?? {},
      latestMeasurement: latestMeasurement
        ? {
            date: latestMeasurement.date,
            weight: latestMeasurement.weight,
            shoulders: latestMeasurement.shoulders,
            neck: latestMeasurement.neck,
            arm: latestMeasurement.arm,
            chest: latestMeasurement.chest,
            waist: latestMeasurement.waist,
            abs: latestMeasurement.abs,
            glutes: latestMeasurement.glutes,
            thigh: latestMeasurement.thigh,
            calf: latestMeasurement.calf,
          }
        : null,
    };
  }

  @Post('onboarding')
  async submitOnboarding(
    @CurrentUser('id') userId: number,
    @Body() dto: OnboardingDto,
  ) {
    await this.onboarding.submit(userId, dto);
    return { ok: true };
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: number,
    @Body() dto: ProfileUpdateDto,
  ) {
    await this.onboarding.update(userId, dto);
    return { ok: true };
  }

  @Patch('language')
  async updateLanguage(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdateLanguageDto,
  ) {
    await this.userModel.update({ language: dto.language }, { where: { id: userId } });
    return { ok: true };
  }

  @Post('refresh-context')
  async refreshContext(@CurrentUser('id') userId: number) {
    await this.coach.refreshContext(userId);
    return { ok: true };
  }
}
