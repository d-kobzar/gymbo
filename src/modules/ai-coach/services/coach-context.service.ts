import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, col, fn, literal } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import { MeasurementEvents } from '@modules/measurements/events/measurement.events';
import { ProgramEvents } from '@modules/programs/events/program.events';
import { TrainingLogEvents } from '@modules/training-logs/events/training-log.events';
import {
  CoachContext,
  CoachDecision,
  CoachProfile,
} from '../models/coach-context.model';

const DECISIONS_CAP = 20;
const SUMMARY_REGEN_THRESHOLD = 10;

export interface InvalidateCoachContextEvent {
  userId: number;
  reason: string;
}

export const COACH_CONTEXT_INVALIDATE_EVENT = 'coach-context.invalidate';
export const COACH_CONTEXT_SUMMARY_REQUESTED = 'coach-context.summary-requested';

/**
 * Owns the managed memory layer on top of OpenAI threads.
 *
 * - `getOrCreate(userId)` returns a row, creating one on first chat.
 * - `buildRunInstructions` composes a compact context block (profile
 *   + live aggregates + rolling summary + recent decisions) that is
 *   injected into the Run's `additional_instructions` — this is how
 *   the coach stays up-to-date without re-reading the whole thread.
 * - Subscribes to domain events to mark the summary stale.
 */
@Injectable()
export class CoachContextService {
  private readonly logger = new Logger(CoachContextService.name);

  constructor(
    @InjectModel(CoachContext)
    private readonly contextModel: typeof CoachContext,
    @InjectModel(TrainingLog)
    private readonly trainingLogModel: typeof TrainingLog,
    @InjectModel(BodyMeasurement)
    private readonly measurementModel: typeof BodyMeasurement,
  ) {}

  async getOrCreate(userId: number): Promise<CoachContext> {
    const [record] = await this.contextModel.findOrCreate({
      where: { userId },
      defaults: { userId } as Partial<CoachContext>,
    });
    return record;
  }

  async updateProfile(
    userId: number,
    patch: Partial<CoachProfile>,
  ): Promise<CoachContext> {
    const ctx = await this.getOrCreate(userId);
    ctx.profile = { ...(ctx.profile ?? {}), ...patch };
    ctx.summaryStale = true;
    await ctx.save();
    return ctx;
  }

  async appendDecision(
    userId: number,
    decision: Omit<CoachDecision, 'at'> & { at?: string },
  ): Promise<CoachContext> {
    const ctx = await this.getOrCreate(userId);
    const entry: CoachDecision = {
      at: decision.at ?? new Date().toISOString(),
      topic: decision.topic,
      decision: decision.decision,
    };
    const next = [...(ctx.recentDecisions ?? []), entry];
    ctx.recentDecisions = next.slice(-DECISIONS_CAP);
    ctx.summaryStale = true;
    await ctx.save();
    return ctx;
  }

  async markStale(userId: number): Promise<void> {
    await this.contextModel.update(
      { summaryStale: true },
      { where: { userId } },
    );
  }

  async recordRunCompleted(userId: number): Promise<{ shouldRegenerate: boolean }> {
    const ctx = await this.getOrCreate(userId);
    ctx.messagesSinceSummary = (ctx.messagesSinceSummary ?? 0) + 1;
    await ctx.save();
    return {
      shouldRegenerate:
        ctx.messagesSinceSummary >= SUMMARY_REGEN_THRESHOLD || ctx.summaryStale,
    };
  }

  async applyRegeneratedSummary(userId: number, summary: string): Promise<void> {
    await this.contextModel.update(
      { rollingSummary: summary, messagesSinceSummary: 0, summaryStale: false },
      { where: { userId } },
    );
  }

  /**
   * Compose the `additional_instructions` block for the next Run.
   * Target ≤ 500 tokens, but we don't enforce — the block is short
   * by construction (fixed-layout lines, 5 PRs, 20 decisions max).
   */
  async buildRunInstructions(userId: number): Promise<string> {
    const ctx = await this.getOrCreate(userId);
    const [aggregates, topPrs] = await Promise.all([
      this.liveAggregates(userId),
      this.topPrs(userId, 5),
    ]);

    const profileLines = this.formatProfile(ctx.profile ?? {});
    const stateLines = this.formatState(aggregates);
    const prLines = topPrs.length
      ? topPrs.map((p) => `  - ${p.name}: ${p.weight}×${p.reps}`).join('\n')
      : '  - (no logs yet)';

    const today = new Date().toISOString().slice(0, 10);
    const summary = ctx.rollingSummary?.trim() ?? '';
    const decisions = ctx.recentDecisions ?? [];
    const decisionLines = decisions.length
      ? decisions
          .slice(-10)
          .map((d) => `  - ${d.at.slice(0, 10)} — ${d.topic}: ${d.decision}`)
          .join('\n')
      : '  - (none)';

    return [
      'User profile:',
      ...profileLines,
      '',
      `Live state (as of ${today}):`,
      ...stateLines,
      '- Top PRs:',
      prLines,
      '',
      'Rolling summary of past conversations:',
      summary || '(empty — this is one of the first sessions)',
      '',
      'Recent decisions:',
      decisionLines,
    ].join('\n');
  }

  // ── Event subscribers ─────────────────────────────────────────
  @OnEvent(TrainingLogEvents.Created)
  @OnEvent(TrainingLogEvents.Updated)
  @OnEvent(TrainingLogEvents.Deleted)
  @OnEvent(MeasurementEvents.Created)
  @OnEvent(MeasurementEvents.Updated)
  @OnEvent(MeasurementEvents.Deleted)
  @OnEvent(ProgramEvents.Created)
  @OnEvent(ProgramEvents.Updated)
  @OnEvent(ProgramEvents.Deleted)
  async onDomainEvent(payload: { userId?: number }): Promise<void> {
    if (!payload?.userId) return;
    try {
      await this.markStale(payload.userId);
    } catch (err) {
      this.logger.warn(
        `markStale failed for userId=${payload.userId}: ${(err as Error).message}`,
      );
    }
  }

  // ── private helpers ───────────────────────────────────────────
  private async liveAggregates(userId: number): Promise<{
    setsThisWeek: number;
    bodyweight: number | null;
    bodyweightTrend7d: number | null;
  }> {
    const weekStart = this.weekStartIso();
    const sevenDaysAgo = this.isoDaysAgo(7);

    const [setsThisWeek, latestBody, prevBody] = await Promise.all([
      this.trainingLogModel.count({
        where: { userId, date: { [Op.gte]: weekStart } },
      }),
      this.measurementModel.findOne({
        where: { userId, weight: { [Op.ne]: null } },
        order: [['date', 'DESC']],
        attributes: ['weight', 'date'],
      }),
      this.measurementModel.findOne({
        where: {
          userId,
          weight: { [Op.ne]: null },
          date: { [Op.lte]: sevenDaysAgo },
        },
        order: [['date', 'DESC']],
        attributes: ['weight'],
      }),
    ]);

    const bodyweight = latestBody?.weight ? Number(latestBody.weight) : null;
    const prevWeight = prevBody?.weight ? Number(prevBody.weight) : null;
    const trend =
      bodyweight != null && prevWeight != null
        ? Number((bodyweight - prevWeight).toFixed(2))
        : null;

    return { setsThisWeek, bodyweight, bodyweightTrend7d: trend };
  }

  private async topPrs(
    userId: number,
    limit: number,
  ): Promise<Array<{ name: string; weight: number; reps: number }>> {
    const rows = await this.trainingLogModel.findAll({
      where: { userId },
      attributes: [
        'exerciseId',
        [fn('MAX', col('weight')), 'maxWeight'],
        [fn('MAX', col('reps')), 'maxReps'],
        [fn('MAX', literal('"reps" * "weight"')), 'maxVolume'],
      ],
      include: [{ model: Exercise, attributes: ['name'] }],
      group: ['exerciseId', 'exercise.id'],
      order: [[literal('"maxWeight"'), 'DESC']],
      limit,
      raw: true,
      nest: true,
    });
    return rows.map((r) => ({
      name: /** @type {any} */ (r as any).exercise?.name ?? `#${(r as any).exerciseId}`,
      weight: Number((r as any).maxWeight ?? 0),
      reps: Number((r as any).maxReps ?? 0),
    }));
  }

  private formatProfile(profile: CoachProfile): string[] {
    const lines: string[] = [];
    lines.push(`- Goal: ${profile.goal ?? 'not set'}`);
    lines.push(`- Level: ${profile.experienceLevel ?? 'not set'}`);
    lines.push(
      `- Days/week: ${profile.trainingDaysPerWeek ?? 'not set'}`,
    );
    lines.push(
      `- Equipment: ${(profile.equipment?.length ?? 0) > 0 ? profile.equipment!.join(', ') : 'not set'}`,
    );
    lines.push(
      `- Injuries: ${(profile.injuries?.length ?? 0) > 0 ? profile.injuries!.join('; ') : 'none reported'}`,
    );
    return lines;
  }

  private formatState(agg: {
    setsThisWeek: number;
    bodyweight: number | null;
    bodyweightTrend7d: number | null;
  }): string[] {
    const lines: string[] = [];
    lines.push(`- Sets this week: ${agg.setsThisWeek}`);
    const bw = agg.bodyweight;
    if (bw != null) {
      const trend = agg.bodyweightTrend7d;
      const trendStr =
        trend != null
          ? ` (7d: ${trend > 0 ? '+' : ''}${trend.toFixed(2)} kg)`
          : '';
      lines.push(`- Bodyweight: ${bw.toFixed(1)} kg${trendStr}`);
    } else {
      lines.push('- Bodyweight: not logged');
    }
    return lines;
  }

  private weekStartIso(): string {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start.toISOString().split('T')[0];
  }

  private isoDaysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }
}
