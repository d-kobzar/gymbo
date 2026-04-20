import { Injectable } from '@nestjs/common';
import type { CoachTool } from '../coach-tool.interface';
import { CoachContextService } from '../../services/coach-context.service';

export interface RecordCoachingDecisionParams {
  topic: string;
  decision: string;
}

export interface RecordCoachingDecisionResult {
  ok: true;
}

@Injectable()
export class RecordCoachingDecisionHandler
  implements
    CoachTool<RecordCoachingDecisionParams, RecordCoachingDecisionResult>
{
  readonly name = 'record_coaching_decision';
  readonly definition = {
    type: 'function' as const,
    function: {
      name: this.name,
      description:
        'Persist a coaching decision you made with the athlete so future sessions remember it (e.g. "deloaded squats", "changed chest-day frequency to 2x"). Concise — one sentence per field.',
      parameters: {
        type: 'object' as const,
        properties: {
          topic: {
            type: 'string',
            description: 'Short label (e.g. "Deload", "Program change", "Form cue").',
          },
          decision: {
            type: 'string',
            description: 'One sentence describing what was decided.',
          },
        },
        required: ['topic', 'decision'],
        additionalProperties: false,
      },
    },
  };

  constructor(private readonly contextService: CoachContextService) {}

  async execute(
    params: RecordCoachingDecisionParams,
    userId: number,
  ): Promise<RecordCoachingDecisionResult> {
    await this.contextService.appendDecision(userId, {
      topic: params.topic,
      decision: params.decision,
    });
    return { ok: true };
  }
}
