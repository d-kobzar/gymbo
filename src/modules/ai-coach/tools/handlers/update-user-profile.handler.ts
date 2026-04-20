import { Injectable } from '@nestjs/common';
import type { CoachTool } from '../coach-tool.interface';
import type { CoachProfile } from '../../models/coach-context.model';
import { CoachContextService } from '../../services/coach-context.service';

export type UpdateUserProfileParams = Partial<CoachProfile>;

export interface UpdateUserProfileResult {
  ok: true;
  profile: CoachProfile;
}

@Injectable()
export class UpdateUserProfileHandler
  implements CoachTool<UpdateUserProfileParams, UpdateUserProfileResult>
{
  readonly name = 'update_user_profile';
  readonly definition = {
    name: this.name,
    description:
      'Persist structured athlete profile facts across sessions. Call this when the user tells you their goal, experience level, equipment, training frequency, or injuries — not when they ask about them.',
    parameters: {
      type: 'object' as const,
      properties: {
        goal: {
          type: 'string',
          enum: ['hypertrophy', 'strength', 'cut', 'maintenance'],
        },
        experienceLevel: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced'],
        },
        trainingDaysPerWeek: { type: 'number', minimum: 1, maximum: 7 },
        equipment: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['barbell', 'dumbbell', 'machines', 'bodyweight', 'cables'],
          },
        },
        injuries: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  };

  constructor(private readonly contextService: CoachContextService) {}

  async execute(
    params: UpdateUserProfileParams,
    userId: number,
  ): Promise<UpdateUserProfileResult> {
    const updated = await this.contextService.updateProfile(userId, params);
    return { ok: true, profile: updated.profile };
  }
}
