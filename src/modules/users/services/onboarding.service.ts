import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { CoachContext } from '@modules/ai-coach/models/coach-context.model';
import { User } from '../models/user.model';
import { OnboardingDto } from '../dto/onboarding.dto';

/**
 * Atomic onboarding: writes the profile into CoachContext, creates
 * the first BodyMeasurement, flips Users.onboardedAt — all in one
 * transaction so a partial fill can't get stuck.
 *
 * Idempotent-ish: if the user is already onboarded we refuse with
 * 409 (editing the profile is a separate endpoint / Settings row).
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
      if (!user) throw new ConflictException('User not found');
      if (user.onboardedAt) {
        throw new ConflictException('Onboarding already completed');
      }

      const [ctx] = await this.contextModel.findOrCreate({
        where: { userId },
        defaults: { userId } as Partial<CoachContext>,
        transaction,
      });
      ctx.profile = {
        ...(ctx.profile ?? {}),
        sex: dto.profile.sex,
        dateOfBirth: dto.profile.dateOfBirth,
        heightCm: dto.profile.heightCm,
        goal: dto.profile.goal,
        experienceLevel: dto.profile.experienceLevel,
        trainingDaysPerWeek: dto.profile.trainingDaysPerWeek,
        equipment: dto.profile.equipment,
        injuries: dto.profile.injuries ?? [],
        healthNotes: dto.profile.healthNotes,
      };
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
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
