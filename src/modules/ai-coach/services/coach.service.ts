import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CoachMessage } from '../models/coach-message.model';
import { MessageQueueService } from './message-queue.service';

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
  ) {}

  enqueue(userId: number, message: string): Promise<void> {
    return this.queue.enqueue(userId, message);
  }

  async clearHistory(userId: number): Promise<void> {
    await this.messageModel.destroy({
      where: { userId, summarizedAt: { [Op.is]: null } },
    });
  }
}
