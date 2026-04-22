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
const SUMMARY_MAX_TOKENS = 800;
const PRESERVE_TAIL = 3;

const SUMMARY_SYSTEM_PROMPT = `You maintain the long-term memory of a strength / hypertrophy coaching conversation.

You receive:
  - the current entity map (structured JSON of facts about the athlete),
  - the previous running summary (text, may be empty),
  - a snapshot of the athlete's current ground truth (program, body, health),
  - a chunk of recent conversation messages to fold into memory.

Your job: produce the new versions of both memory layers and return them as strict JSON.

## newEntityMap (object)
Update the entity map with any new durable facts revealed in the messages: ongoing injuries or pains, declared goals, dietary phase, lifestyle changes (sleep deficits, travel, illness), explicit preferences, decisions you and the athlete agreed to, named commitments. Remove entries that the athlete explicitly resolved or abandoned. Common keys: \`ongoingInjuries\`, \`currentGoal\`, \`dietPhase\`, \`motivationState\`, \`recentDecisions\` (small array of one-line strings), \`timeConstraints\`. Keys are free-form — pick what fits.

Do NOT store in entityMap:
  - Program structure (exercises / sets / reps / weights).
  - Current PRs, bodyweight, circumferences.
  - Anything already in the ground truth snapshot.

## newSummary (string, ≤ 200 tokens, single paragraph)
A narrative pass of what was discussed and agreed. Behavioral patterns (consistency, adherence), self-reported state across turns, open threads. No specifics of the program. No rest-interval advice, RIR targets, warm-up protocols, set / rep ranges — those are re-derivable every turn and do not belong in a narrative.

If the previous summary contradicts the ground truth snapshot (old program, healed injury, abandoned goal), drop the contradicting phrases — the ground truth wins.

## Output — STRICT JSON, no prose, no markdown
{"newEntityMap": { ... }, "newSummary": "..."}`;

/**
 * Memory-update worker. Two entry points:
 *   - Event-driven: COACH_SUMMARY_REQUESTED fires when the Active
 *     Buffer token count crosses the threshold after a run.
 *   - UI-driven: refresh() is invoked by the "Обновить контекст"
 *     button in settings.
 *
 * Both paths call summarizeContext(userId) which pulls the Active
 * Buffer (minus the last few messages to preserve the current
 * conversation thread), asks gpt-4o-mini to produce strict JSON with
 * the updated entityMap and running summary, and applies both
 * atomically via ContextService.applyMemoryUpdate.
 *
 * Runs off the request path so TTFT stays clean. Inflight guard
 * prevents two parallel summarizations for the same user.
 */
@Injectable()
export class RollingSummaryService {
  private readonly logger = new Logger(RollingSummaryService.name);
  private readonly client: OpenAI | null;
  private readonly gcDays: number;
  private readonly inflight = new Map<number, Promise<void>>();

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
    const userId = payload.userId;
    if (this.inflight.has(userId)) return; // already processing
    const task = this.summarizeContext(userId, { preserveTail: PRESERVE_TAIL }).finally(() => {
      this.inflight.delete(userId);
    });
    this.inflight.set(userId, task);
    try {
      await task;
    } catch (err) {
      this.logger.warn(
        `memory update failed for userId=${userId}: ${(err as Error).message}`,
      );
    }
  }

  /** On-demand refresh from settings. Unlike the event-driven fold
   * which preserves the last 3 in-flight messages, the UI-triggered
   * refresh folds the WHOLE Active Buffer — the athlete explicitly
   * asked to rebuild memory now, including the most recent turns. */
  async refresh(userId: number): Promise<void> {
    if (!this.client) return;
    await this.summarizeContext(userId, { preserveTail: 0 });
  }

  /**
   * Weekly cleanup. Messages with summaryStatus='processed' whose
   * summarizedAt is older than the retention window get dropped.
   * Runs Sunday at midnight.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupSummarizedMessages(): Promise<void> {
    const cutoff = new Date(Date.now() - this.gcDays * 24 * 60 * 60 * 1000);
    try {
      const deleted = await this.messageModel.destroy({
        where: {
          summaryStatus: 'processed',
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

  private async summarizeContext(
    userId: number,
    opts: { preserveTail: number },
  ): Promise<void> {
    if (!this.client) return;

    const buffer = await this.contextService.loadActiveBuffer(userId);
    if (buffer.length === 0) return;
    if (buffer.length <= opts.preserveTail) return;

    const toSummarize = opts.preserveTail
      ? buffer.slice(0, buffer.length - opts.preserveTail)
      : buffer;

    const [ctx, groundTruthSnapshot] = await Promise.all([
      this.contextService.getOrCreate(userId),
      this.contextService.buildSummarizerSnapshot(userId),
    ]);

    const oldEntityMap = ctx.entityMap ?? {};
    const oldSummary = ctx.rollingSummary?.trim() ?? '';
    const conversationChunk = toSummarize
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const userPayload = [
      '## Current entity map',
      JSON.stringify(oldEntityMap, null, 2),
      '',
      '## Previous running summary',
      oldSummary || '(none yet)',
      '',
      '## Current ground truth snapshot (authoritative)',
      groundTruthSnapshot,
      '',
      '## Messages to fold in',
      conversationChunk,
    ].join('\n');

    const completion = await this.client.chat.completions.create({
      model: SUMMARY_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: SUMMARY_MAX_TOKENS,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      this.logger.warn(
        `summarizer returned empty for userId=${userId}; keeping prior memory`,
      );
      return;
    }

    let parsed: { newEntityMap?: Record<string, unknown>; newSummary?: string };
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger.warn(
        `summarizer returned non-JSON for userId=${userId}: ${(err as Error).message}`,
      );
      return;
    }

    const newEntityMap =
      parsed.newEntityMap && typeof parsed.newEntityMap === 'object'
        ? parsed.newEntityMap
        : oldEntityMap;
    const newSummary =
      typeof parsed.newSummary === 'string' && parsed.newSummary.trim()
        ? parsed.newSummary.trim()
        : oldSummary;

    await this.contextService.applyMemoryUpdate(
      userId,
      newEntityMap,
      newSummary,
      toSummarize.map((m) => m.id),
    );

    this.logger.log(
      `memory updated for userId=${userId} (${toSummarize.length} msgs folded, ${Object.keys(newEntityMap).length} entity-map keys, summary ${newSummary.length} chars)`,
    );
  }
}
