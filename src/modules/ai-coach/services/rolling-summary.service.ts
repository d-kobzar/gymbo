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

const SUMMARY_SYSTEM_PROMPT = `You maintain a compressed rolling NARRATIVE of a strength coaching conversation.

You will receive three things:
1. The previous summary (may be stale — can reference an old program, old injuries since healed, old goals since abandoned).
2. The athlete's CURRENT ground truth (live program, latest body snapshot, health). Pulled fresh from the database — this is authoritative.
3. Recent conversation tail (the newest turns since the last summary).

Your job: produce a single updated paragraph that reconciles them.

Reconciliation rules:
- If the previous summary references a program, injury, goal, or body fact that contradicts ground truth — DROP or UPDATE the contradicting phrase. The ground truth wins, every time. Do not paraphrase stale facts forward.
- If ground truth mentions something the athlete never discussed in chat (e.g. a freshly-saved program), you can reference it by name only, but do not replicate its structure — that's always injected fresh separately.
- You do not need to restate the ground truth. It is injected into every coach turn anyway.

Preserve:
- The athlete's self-reported state across sessions (recurring soreness, sleep / stress / energy patterns, recovery issues).
- Decisions the athlete and coach landed on, and the WHY behind them.
- Behavioral patterns (consistency issues, time constraints, strong preferences, motivators / demotivators).
- Pending next-session plan only if it was explicitly agreed.

Drop:
- Small talk, pleasantries, greetings.
- Specific sets / reps / weights / exercise names from the program.
- Current PRs, bodyweight, latest-session numbers — all live elsewhere.

Output a single paragraph under 200 tokens. No bullet lists. No preamble.`;

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
   * in settings). Same incremental fold as the event-driven path —
   * prior summary + unsummarized tail + live ground truth — but
   * surfaces errors to the caller. The summarizer is instructed to
   * reconcile against the injected ground truth, so stale phrases
   * (old program, healed injuries, abandoned goals) get dropped
   * instead of paraphrased forward. */
  async refresh(userId: number): Promise<void> {
    if (!this.client) return;
    await this.regenerate(userId);
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

    const [previous, groundTruth] = await Promise.all([
      this.contextService.getOrCreate(userId),
      this.contextService.buildSummarizerSnapshot(userId),
    ]);
    const prior = previous.rollingSummary?.trim() ?? '';

    const tailText = tail
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');
    const userPrompt = [
      '## Previous summary (may be stale)',
      prior || '(none yet)',
      '',
      '## Current ground truth (authoritative — pulled fresh from DB)',
      groundTruth,
      '',
      '## Recent conversation tail',
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
    const next = completion.choices[0]?.message?.content?.trim() ?? '';
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
}
