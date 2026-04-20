import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CoachContext } from '@modules/ai-coach/models/coach-context.model';
import { OnboardingDto } from './dto/onboarding.dto';
import { User } from './models/user.model';
import { OnboardingService } from './services/onboarding.service';

/**
 * Public user endpoints: "me" (identity + onboarding state + coach
 * profile) and the onboarding submission.
 *
 * "me" is safe to call on every app boot and is cheap — one joined
 * fetch.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(CoachContext)
    private readonly contextModel: typeof CoachContext,
    private readonly onboarding: OnboardingService,
  ) {}

  @Get('me')
  async me(@CurrentUser('id') userId: number) {
    const user = await this.userModel.findByPk(userId);
    if (!user) return { id: null };
    const ctx = await this.contextModel.findOne({ where: { userId } });
    return {
      id: user.id,
      telegramId: user.telegramId,
      name: user.name,
      language: user.language,
      timezone: user.timezone,
      onboardedAt: user.onboardedAt,
      profile: ctx?.profile ?? {},
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
}
