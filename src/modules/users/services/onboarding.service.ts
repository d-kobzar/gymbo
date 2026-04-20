import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { CoachContext, CoachProfile } from '@modules/ai-coach/models/coach-context.model';
import { User } from '../models/user.model';
import { OnboardingDto } from '../dto/onboarding.dto';
import { ProfileUpdateDto } from '../dto/profile-update.dto';

/**
 * Atomic onboarding + profile edits.
 *
 * `submit` (first time): writes profile into CoachContext, creates
 * the first BodyMeasurement, flips onboardedAt. Refuses with 409 if
 * already onboarded.
 *
 * `update` (post-onboarding): patches CoachContext.profile and
 * optionally records a new BodyMeasurement. Always flags
 * summaryStale so the coach re-reads fresh facts on the next chat.
 */
@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(CoachContext)
    private readonly contextModel: typeof CoachContext,
    @InjectModel(BodyMeasurement)
    private readonly measurementModel: typeof BodyMeasurement,
    private readonly sequelize: Sequelize,
  ) {}

  async submit(userId: number, dto: OnboardingDto): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      const user = await this.userModel.findByPk(userId, { transaction });
      if (!user) throw new NotFoundException('User not found');
      if (user.onboardedAt) {
        throw new ConflictException('Onboarding already completed');
      }

      const [ctx] = await this.contextModel.findOrCreate({
        where: { userId },
        defaults: { userId } as Partial<CoachContext>,
        transaction,
      });
      ctx.profile = this.mergeProfile(ctx.profile, dto.profile);
      ctx.summaryStale = true;
      await ctx.save({ transaction });

      await this.measurementModel.create(
        {
          userId,
          date: todayIso(),
          ...dto.measurement,
        } as Partial<BodyMeasurement>,
        { transaction },
      );

      user.onboardedAt = new Date();
      await user.save({ transaction });
    });
  }

  async update(userId: number, dto: ProfileUpdateDto): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      const user = await this.userModel.findByPk(userId, { transaction });
      if (!user) throw new NotFoundException('User not found');

      const [ctx] = await this.contextModel.findOrCreate({
        where: { userId },
        defaults: { userId } as Partial<CoachContext>,
        transaction,
      });
      ctx.profile = this.mergeProfile(ctx.profile, dto.profile);
      ctx.summaryStale = true;
      await ctx.save({ transaction });

      if (dto.measurement) {
        await this.measurementModel.create(
          {
            userId,
            date: todayIso(),
            ...dto.measurement,
          } as Partial<BodyMeasurement>,
          { transaction },
        );
      }

      // Keep onboardedAt set — editing after the initial flow does
      // NOT reset the gate.
      if (!user.onboardedAt) {
        user.onboardedAt = new Date();
        await user.save({ transaction });
      }
    });
  }

  private mergeProfile(
    existing: CoachProfile | undefined,
    incoming: OnboardingDto['profile'] | ProfileUpdateDto['profile'],
  ): CoachProfile {
    return {
      ...(existing ?? {}),
      sex: incoming.sex,
      dateOfBirth: incoming.dateOfBirth,
      heightCm: incoming.heightCm,
      goal: incoming.goal,
      experienceLevel: incoming.experienceLevel,
      trainingDaysPerWeek: incoming.trainingDaysPerWeek,
      equipment: incoming.equipment,
      injuries: incoming.injuries ?? [],
      healthNotes: incoming.healthNotes,
    };
  }
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
