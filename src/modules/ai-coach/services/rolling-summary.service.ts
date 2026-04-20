import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Op } from 'sequelize';
import OpenAI from 'openai';
import type { LlmConfig } from '@core/config/llm.config';
import type { OpenAIConfig } from '@core/config/openai.config';
import { CoachMessage } from '../models/coach-message.model';
import { CoachContextService } from './coach-context.service';

export const COACH_SUMMARY_REQUESTED = 'coach-context.summary-requested';

export interface SummaryRequestedPayload {
  userId: number;
}

const SUMMARY_MODEL = 'gpt-4o-mini';
const SUMMARY_MAX_TOKENS = 300;
const SUMMARY_TAIL_SIZE = 20;
const REBUILD_TAIL_SIZE = 50;

const SUMMARY_SYSTEM_PROMPT = `You maintain a compressed rolling NARRATIVE of a strength coaching conversation.

Preserve ONLY:
- The athlete's self-reported state across sessions (recurring soreness, sleep/stress/energy patterns they mentioned, recovery issues).
- Decisions or adjustments the athlete and coach landed on, and the WHY behind them.
- Behavioral patterns (consistency issues, time constraints, strong preferences, things that motivate or demotivate).
- Pending next-session plan only if it was explicitly agreed.

Drop entirely — this data is injected fresh every turn, DO NOT duplicate it here:
- The athlete's current training program (days, exercises, sets, frequency). The program changes; your mention of it rots.
- Current personal records, max weights, total sets, latest bodyweight, last session's numbers. All live.
- Raw circumferences, goal labels, equipment list, injury list, dates of birth. All in the profile.
- Small talk, pleasantries, greetings.

Output a single paragraph under 200 tokens. No bullet lists. No preamble. No mention of specific exercise names, sets, reps, or weights — refer to "the current program" or "the prescribed block" in the abstract.`;

/**
 * Rolling-summary regenerator. Fires asynchronously after the coach
 * finishes a batch — reads the tail of CoachMessages from the DB,
 * compresses (previous summary + tail) into a new paragraph, writes
 * it back to CoachContext, and marks the consumed messages with
 * summarizedAt so the GC cron can delete them after the retention
 * window.
 *
 * Intentionally pinned to OpenAI for now — gpt-4o-mini is cheap and
 * fast for summarization and doesn't need the provider abstraction.
 * If/when a user wants full provider independence we can route this
 * through LlmProvider too.
 */
@Injectable()
export class RollingSummaryService {
  private readonly logger = new Logger(RollingSummaryService.name);
  private readonly client: OpenAI | null;
  private readonly gcDays: number;

  constructor(
    config: ConfigService,
    private readonly contextService: CoachContextService,
    @InjectModel(CoachMessage) private readonly messageModel: typeof CoachMessage,
  ) {
    const { apiKey } = config.getOrThrow<OpenAIConfig>('openai');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    this.gcDays = config.getOrThrow<LlmConfig>('llm').messageGcDays;
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

  /** On-demand refresh triggered from the UI ("Обновить контекст"
   * in settings). Unlike the event-driven incremental fold, this is a
   * full REBUILD: the prior summary is discarded entirely (so a stale
   * narrative referencing an obsolete program / body stat can't seep
   * forward through paraphrase), and we compose a new paragraph from
   * the last REBUILD_TAIL_SIZE messages regardless of summarizedAt.
   * Surfaces errors to the caller. */
  async refresh(userId: number): Promise<void> {
    if (!this.client) return;
    await this.rebuild(userId);
  }

  /** Cron job: delete CoachMessages whose summarizedAt is older than
   * the retention window (default 7 days). Runs once a day at 03:00
   * server time — the window is not time-sensitive, we just want to
   * bound storage growth. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupSummarizedMessages(): Promise<void> {
    const cutoff = new Date(Date.now() - this.gcDays * 24 * 60 * 60 * 1000);
    try {
      const deleted = await this.messageModel.destroy({
        where: {
          summarizedAt: { [Op.ne]: null, [Op.lte]: cutoff },
        },
      });
      if (deleted > 0) {
        this.logger.log(
          `gc: deleted ${deleted} summarized coach messages older than ${this.gcDays}d`,
        );
      }
    } catch (err) {
      this.logger.warn(`gc failed: ${(err as Error).message}`);
    }
  }

  private async regenerate(userId: number): Promise<void> {
    if (!this.client) return;

    const tail = await this.messageModel.findAll({
      where: { userId, summarizedAt: null },
      order: [['createdAt', 'ASC']],
      limit: SUMMARY_TAIL_SIZE,
    });
    if (tail.length === 0) return;

    const previous = await this.contextService.getOrCreate(userId);
    const prior = previous.rollingSummary?.trim() ?? '';

    const next = await this.compress(prior, tail);
    if (!next) return;

    const summarizedAt = new Date();
    await this.contextService.applyRegeneratedSummary(userId, next);
    await this.messageModel.update(
      { summarizedAt },
      { where: { id: { [Op.in]: tail.map((m) => m.id) } } },
    );
    this.logger.log(
      `rolling-summary regenerated for userId=${userId} (${next.length} chars, ${tail.length} msgs folded)`,
    );
  }

  private async rebuild(userId: number): Promise<void> {
    if (!this.client) return;

    // Clear first so that if compression fails we still land in a
    // clean "no summary yet" state rather than keeping the stale one.
    await this.contextService.applyRegeneratedSummary(userId, '');

    const tail = await this.messageModel.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: REBUILD_TAIL_SIZE,
    });
    if (tail.length === 0) {
      this.logger.log(`rolling-summary rebuild: no messages for userId=${userId}`);
      return;
    }
    tail.reverse();

    // Deliberately pass no prior — this is a full reset, we don't want
    // the stale narrative to leak through paraphrasing.
    const next = await this.compress('', tail);
    if (!next) return;

    const summarizedAt = new Date();
    await this.contextService.applyRegeneratedSummary(userId, next);
    await this.messageModel.update(
      { summarizedAt },
      {
        where: {
          id: { [Op.in]: tail.map((m) => m.id) },
          summarizedAt: null,
        },
      },
    );
    this.logger.log(
      `rolling-summary rebuilt for userId=${userId} (${next.length} chars, ${tail.length} msgs)`,
    );
  }

  private async compress(prior: string, tail: CoachMessage[]): Promise<string> {
    if (!this.client) return '';
    const tailText = tail
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');
    const userPrompt = [
      'Previous summary:',
      prior || '(none yet)',
      '',
      'Recent conversation tail:',
      tailText,
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
    return completion.choices[0]?.message?.content?.trim() ?? '';
  }
}
