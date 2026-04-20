import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, col, fn, literal } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { ProgramDay } from '@modules/programs/models/program-day.model';
import { ProgramExercise } from '@modules/programs/models/program-exercise.model';
import { Program } from '@modules/programs/models/program.model';
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
const LAST_SESSIONS = 3;
const DAYS_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
const SHORT_DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface InvalidateCoachContextEvent {
  userId: number;
  reason: string;
}

export const COACH_CONTEXT_INVALIDATE_EVENT = 'coach-context.invalidate';
export const COACH_CONTEXT_SUMMARY_REQUESTED = 'coach-context.summary-requested';

/**
 * Owns the managed memory layer on top of OpenAI threads.
 *
 * `buildRunInstructions` composes the block injected into every Run's
 * `additional_instructions`:
 *   - User profile (goal, level, equipment, injuries, sex, age,
 *     height, weight, health notes) — from CoachContext.profile
 *     which onboarding writes.
 *   - Live state — sets this week, bodyweight + 7d trend,
 *     top-5 PRs.
 *   - Current program — name + per-day one-liner.
 *   - Last 3 training sessions — date + exercises + totals.
 *   - Rolling summary — compressed narrative.
 *   - Recent decisions — last 10 by time.
 *
 * Subscribes to TrainingLog / Measurement / Program events so
 * summary staleness flips the moment the athlete logs anything.
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
    @InjectModel(Program) private readonly programModel: typeof Program,
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

  async buildRunInstructions(userId: number): Promise<string> {
    const ctx = await this.getOrCreate(userId);
    const [aggregates, topPrs, program, lastSessions] = await Promise.all([
      this.liveAggregates(userId),
      this.topPrs(userId, 5),
      this.currentProgram(userId),
      this.lastSessions(userId, LAST_SESSIONS),
    ]);

    const profileLines = this.formatProfile(ctx.profile ?? {});
    const stateLines = this.formatState(aggregates);
    const prLines = topPrs.length
      ? topPrs.map((p) => `  - ${p.name}: ${p.weight}×${p.reps}`).join('\n')
      : '  - (no logs yet)';

    const programLines = this.formatProgram(program);
    const sessionsLines = this.formatLastSessions(lastSessions);

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
      'Current program:',
      ...programLines,
      '',
      `Last ${LAST_SESSIONS} sessions:`,
      ...sessionsLines,
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
      name: (r as any).exercise?.name ?? `#${(r as any).exerciseId}`,
      weight: Number((r as any).maxWeight ?? 0),
      reps: Number((r as any).maxReps ?? 0),
    }));
  }

  private async currentProgram(userId: number): Promise<Program | null> {
    return this.programModel.findOne({
      where: { userId },
      order: [['version', 'DESC']],
      include: [
        {
          model: ProgramDay,
          include: [
            {
              model: ProgramExercise,
              include: [{ model: Exercise, attributes: ['name'] }],
            },
          ],
        },
      ],
    });
  }

  private async lastSessions(
    userId: number,
    count: number,
  ): Promise<
    Array<{
      date: string;
      totalSets: number;
      totalVolume: number;
      exercises: Array<{ name: string; sets: number; topWeight: number; topReps: number }>;
    }>
  > {
    const dateRows = await this.trainingLogModel.findAll({
      where: { userId },
      attributes: ['date'],
      group: ['date'],
      order: [['date', 'DESC']],
      limit: count,
      raw: true,
    });
    const dates = dateRows
      .map((r) => (r as any).date as string)
      .filter(Boolean);
    if (!dates.length) return [];

    const logs = await this.trainingLogModel.findAll({
      where: { userId, date: { [Op.in]: dates } },
      include: [{ model: Exercise, attributes: ['name'] }],
      order: [['date', 'DESC'], ['setNumber', 'ASC']],
    });

    const byDate = new Map<
      string,
      Map<string, { sets: number; topWeight: number; topReps: number; volume: number }>
    >();
    for (const l of logs) {
      const date = (l as any).date as string;
      const exName = (l as any).exercise?.name ?? `#${(l as any).exerciseId}`;
      const weight = Number((l as any).weight ?? 0);
      const reps = Number((l as any).reps ?? 0);
      const byEx = byDate.get(date) ?? new Map();
      const ex = byEx.get(exName) ?? { sets: 0, topWeight: 0, topReps: 0, volume: 0 };
      ex.sets += 1;
      ex.topWeight = Math.max(ex.topWeight, weight);
      ex.topReps = Math.max(ex.topReps, reps);
      ex.volume += weight * reps;
      byEx.set(exName, ex);
      byDate.set(date, byEx);
    }

    return dates.map((date) => {
      const byEx = byDate.get(date) ?? new Map();
      const exercises = Array.from(byEx.entries()).map(([name, v]) => ({
        name,
        sets: v.sets,
        topWeight: v.topWeight,
        topReps: v.topReps,
      }));
      const totalSets = exercises.reduce((s, e) => s + e.sets, 0);
      const totalVolume = Array.from(byEx.values()).reduce((s, v) => s + v.volume, 0);
      return { date, totalSets, totalVolume, exercises };
    });
  }

  private formatProfile(profile: CoachProfile): string[] {
    const lines: string[] = [];
    lines.push(`- Goal: ${profile.goal ?? 'not set'}`);
    lines.push(`- Level: ${profile.experienceLevel ?? 'not set'}`);
    lines.push(`- Days/week: ${profile.trainingDaysPerWeek ?? 'not set'}`);
    lines.push(
      `- Equipment: ${(profile.equipment?.length ?? 0) > 0 ? profile.equipment!.join(', ') : 'not set'}`,
    );
    lines.push(`- Sex: ${profile.sex ?? 'not set'}`);
    const age = this.ageFromDob(profile.dateOfBirth);
    lines.push(`- Age: ${age != null ? `${age} y` : 'not set'}`);
    lines.push(
      `- Height: ${profile.heightCm != null ? `${profile.heightCm} cm` : 'not set'}`,
    );
    lines.push(
      `- Injuries: ${(profile.injuries?.length ?? 0) > 0 ? profile.injuries!.join('; ') : 'none reported'}`,
    );
    if (profile.healthNotes?.trim()) {
      lines.push(`- Health notes: ${profile.healthNotes.trim()}`);
    }
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

  private formatProgram(program: Program | null): string[] {
    if (!program) return ['  - (no program yet)'];
    const lines: string[] = [`  - ${program.name ?? 'Program'} · v${program.version}`];
    const days = [...(program.days ?? [])].sort((a, b) => {
      const ai = DAYS_ORDER.indexOf((a.day ?? '').toLowerCase());
      const bi = DAYS_ORDER.indexOf((b.day ?? '').toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    for (const day of days) {
      const idx = DAYS_ORDER.indexOf((day.day ?? '').toLowerCase());
      const dow = idx >= 0 ? SHORT_DOW[idx] : day.day ?? '?';
      if (day.isRest) {
        lines.push(`  - ${dow}: rest`);
        continue;
      }
      const exs = (day.exercises ?? [])
        .map((e) => `${e.exercise?.name ?? '?'}×${e.sets ?? '?'}`)
        .join(', ');
      lines.push(`  - ${dow}: ${exs || '(no exercises)'}`);
    }
    return lines;
  }

  private formatLastSessions(
    sessions: Array<{
      date: string;
      totalSets: number;
      totalVolume: number;
      exercises: Array<{ name: string; sets: number; topWeight: number; topReps: number }>;
    }>,
  ): string[] {
    if (!sessions.length) return ['  - (no sessions yet)'];
    const lines: string[] = [];
    for (const s of sessions) {
      const summary = s.exercises
        .map((e) => `${e.name} ${e.topWeight}×${e.topReps}×${e.sets}`)
        .join(', ');
      const volume = Math.round(s.totalVolume);
      lines.push(
        `  - ${s.date}: ${s.totalSets} sets · ${volume} kg·reps — ${summary}`,
      );
    }
    return lines;
  }

  private ageFromDob(dob?: string): number | null {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    return age;
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
