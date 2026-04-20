import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import OpenAI from 'openai';
import type { OpenAIConfig } from '@core/config/openai.config';
import { CoachContextService } from './coach-context.service';
import { ThreadManagerService } from './thread-manager.service';

export const COACH_SUMMARY_REQUESTED = 'coach-context.summary-requested';

export interface SummaryRequestedPayload {
  userId: number;
}

const MAX_TAIL_MESSAGES = 20;
const SUMMARY_MODEL = 'gpt-4o-mini';
const SUMMARY_MAX_TOKENS = 300;

const SUMMARY_SYSTEM_PROMPT = `You maintain a compressed rolling summary of a strength coaching conversation.
Preserve: athlete's declared goals, notable PRs, decisions about programming changes,
injuries or constraints the athlete mentioned, and any pending next-session plan.
Drop small talk, pleasantries, and specifics the coach can re-derive from training logs.
Output a single paragraph under 200 tokens. No bullet lists. No preamble.`;

/**
 * Asynchronous rolling-summary regenerator. Listens for
 * COACH_SUMMARY_REQUESTED events that AssistantService fires after
 * a completed Run. Runs a short chat.completions call with the
 * previous summary + recent thread tail; writes the result back to
 * CoachContext.
 *
 * Kept out of the request path — failures here don't bubble up to
 * the chat reply.
 */
@Injectable()
export class RollingSummaryService {
  private readonly logger = new Logger(RollingSummaryService.name);
  private readonly client: OpenAI | null;

  constructor(
    config: ConfigService,
    private readonly contextService: CoachContextService,
    private readonly threadManager: ThreadManagerService,
  ) {
    const { apiKey } = config.getOrThrow<OpenAIConfig>('openai');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  @OnEvent(COACH_SUMMARY_REQUESTED)
  async handle(payload: SummaryRequestedPayload): Promise<void> {
    if (!this.client || !payload?.userId) return;
    try {
      await this.regenerate(payload.userId);
    } catch (err) {
      this.logger.warn(
        `rolling-summary regen failed for userId=${payload.userId}: ${(err as Error).message}`,
      );
    }
  }

  private async regenerate(userId: number): Promise<void> {
    if (!this.client) return;

    const thread = await this.threadManager.findThreadId(userId);
    if (!thread) return;

    const previous = await this.contextService.getOrCreate(userId);
    const messages = await this.client.beta.threads.messages.list(thread, {
      limit: MAX_TAIL_MESSAGES,
      order: 'desc',
    });

    const tail = messages.data
      .reverse()
      .map((m) => {
        const text = m.content
          .map((chunk) => (chunk.type === 'text' ? chunk.text.value : ''))
          .join(' ')
          .trim();
        return text ? `${m.role.toUpperCase()}: ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');
    if (!tail) return;

    const prior = previous.rollingSummary?.trim() ?? '';
    const userPrompt = [
      'Previous summary:',
      prior || '(none yet)',
      '',
      'Recent thread tail:',
      tail,
    ].join('\n');

    const completion = await this.client.chat.completions.create({
      model: SUMMARY_MODEL,
      max_tokens: SUMMARY_MAX_TOKENS,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const next = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!next) return;

    await this.contextService.applyRegeneratedSummary(userId, next);
    this.logger.log(
      `rolling-summary regenerated for userId=${userId} (${next.length} chars)`,
    );
  }
}
