import { Injectable } from '@nestjs/common';
import { AssistantService } from './assistant.service';

/**
 * Public facade over the assistant. Other modules (bot, API controllers)
 * depend on this — NOT on AssistantService directly — so that Phase 3
 * can interpose CoachContext / rolling-summary logic here without
 * ripple.
 */
@Injectable()
export class CoachService {
  constructor(private readonly assistant: AssistantService) {}

  chat(userId: number, message: string): Promise<string> {
    return this.assistant.chat(userId, message);
  }

  clearHistory(userId: number): Promise<void> {
    return this.assistant.clearHistory(userId);
  }
}
