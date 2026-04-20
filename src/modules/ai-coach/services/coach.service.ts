import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CoachMessage } from '../models/coach-message.model';
import { CoachContextService } from './coach-context.service';
import { MessageQueueService } from './message-queue.service';
import { RollingSummaryService } from './rolling-summary.service';

/**
 * Public facade for other modules (bot, future API controllers).
 *
 * `enqueue` is fire-and-forget: the message lands in DB, the debounced
 * coach queue eventually runs the LLM and pushes the reply to Telegram
 * via BotService.sendToChat. Callers don't await the reply.
 *
 * `clearHistory` resets the conversation for a user (e.g. "start
 * fresh" button / /reset command).
 */
@Injectable()
export class CoachService {
  constructor(
    @InjectModel(CoachMessage) private readonly messageModel: typeof CoachMessage,
    private readonly queue: MessageQueueService,
    private readonly summary: RollingSummaryService,
    private readonly context: CoachContextService,
  ) {}

  enqueue(userId: number, message: string): Promise<void> {
    return this.queue.enqueue(userId, message);
  }

  async clearHistory(userId: number): Promise<void> {
    await this.messageModel.destroy({
      where: { userId, summarizedAt: { [Op.is]: null } },
    });
  }

  /** "Refresh context" button in settings. Regenerates the rolling
   * summary against the unsummarized message tail and marks the
   * stored context non-stale so the next LLM turn starts from a clean
   * snapshot. Live state (program, last 3 sessions, latest body) is
   * always pulled fresh per-turn, so this only needs to touch the
   * summary + staleness flag. */
  async refreshContext(userId: number): Promise<void> {
    await this.summary.refresh(userId);
    await this.context.markFresh(userId);
  }
}
