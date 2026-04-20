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
import { User } from '@modules/users/models/user.model';
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
    @InjectModel(User) private readonly userModel: typeof User,
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

  async markFresh(userId: number): Promise<void> {
    await this.contextModel.update(
      { summaryStale: false, messagesSinceSummary: 0 },
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

  /** Compact live-state snapshot for the summarizer. We hand the
   * summarizer not just the stale prior summary + recent chat, but
   * also the ground truth it should reconcile against — so phrases
   * like "user's program is FULL_BODY_5" don't paraphrase forward
   * when the current program is actually PushPull v1. */
  async buildSummarizerSnapshot(userId: number): Promise<string> {
    const ctx = await this.getOrCreate(userId);
    const [program, latestBody] = await Promise.all([
      this.currentProgram(userId),
      this.latestMeasurement(userId),
    ]);
    const profile = ctx.profile ?? {};

    const programLine = program
      ? `${program.name ?? 'Program'} · v${program.version}`
      : 'no program saved';

    const bodyBits: string[] = [];
    if (latestBody) {
      if (latestBody.weight != null) bodyBits.push(`weight ${Number(latestBody.weight).toFixed(1)} kg`);
      if (latestBody.waist != null) bodyBits.push(`waist ${Number(latestBody.waist).toFixed(1)} cm`);
      if (latestBody.chest != null) bodyBits.push(`chest ${Number(latestBody.chest).toFixed(1)} cm`);
      if (latestBody.arm != null) bodyBits.push(`arm ${Number(latestBody.arm).toFixed(1)} cm`);
    }
    const bodyLine = latestBody
      ? `${latestBody.date} — ${bodyBits.join(', ') || 'no measurements recorded on that date'}`
      : 'no body measurements logged';

    const injuries =
      (profile.injuries?.length ?? 0) > 0
        ? profile.injuries!.join('; ')
        : 'none reported';
    const healthNotes = profile.healthNotes?.trim() || 'none reported';

    return [
      `- Goal: ${profile.goal ?? 'not set'}`,
      `- Current program: ${programLine}`,
      `- Latest body snapshot: ${bodyLine}`,
      `- Injuries: ${injuries}`,
      `- Health notes: ${healthNotes}`,
    ].join('\n');
  }

  async buildRunInstructions(userId: number): Promise<string> {
    const ctx = await this.getOrCreate(userId);
    const [user, aggregates, topPrs, program, lastSessions, latestBody] =
      await Promise.all([
        this.userModel.findByPk(userId, { attributes: ['timezone', 'language'] }),
        this.liveAggregates(userId),
        this.topPrs(userId, 5),
        this.currentProgram(userId),
        this.lastSessions(userId, LAST_SESSIONS),
        this.latestMeasurement(userId),
      ]);

    const tz = user?.timezone || 'UTC';
    const moment = this.formatContextMoment(tz);
    const todayDow = moment.dowKey;
    const profile = ctx.profile ?? {};

    const profileLines = this.formatProfile(profile);
    const healthLines = this.formatHealth(profile);
    const stateLines = this.formatState(aggregates);
    const prLines = topPrs.length
      ? topPrs.map((p) => `  - ${p.name}: ${p.weight}×${p.reps}`).join('\n')
      : '  - (no logs yet)';

    const programLines = this.formatProgram(program, todayDow);
    const todayPlanLine = this.formatTodaysPlan(program, todayDow);
    const sessionsLines = this.formatLastSessions(lastSessions);
    const measurementLines = this.formatLatestMeasurement(latestBody);

    const summary = ctx.rollingSummary?.trim() ?? '';
    const decisions = ctx.recentDecisions ?? [];
    const decisionLines = decisions.length
      ? decisions
          .slice(-10)
          .map((d) => `  - ${d.at.slice(0, 10)} — ${d.topic}: ${d.decision}`)
          .join('\n')
      : '  - (none)';

    return [
      '### CONTEXT MOMENT',
      `- Local date: ${moment.date} (${moment.dowLabel})`,
      `- Local time: ${moment.time} (${moment.partOfDay})`,
      `- Timezone: ${tz}`,
      `- Today's plan: ${todayPlanLine}`,
      '',
      '### GROUND TRUTH — authoritative, pulled fresh every turn.',
      '### If anything below contradicts the HISTORICAL NARRATIVE further down,',
      '### the ground truth wins. Cite from here when stating facts about the athlete.',
      '',
      '## Athlete profile',
      ...profileLines,
      '',
      '## Health & constraints',
      ...healthLines,
      '',
      '## Live metrics',
      ...stateLines,
      '- Top PRs:',
      prLines,
      '',
      '## Latest body snapshot',
      ...measurementLines,
      '',
      '## Current program',
      ...programLines,
      '',
      `## Last ${LAST_SESSIONS} sessions (most recent first)`,
      ...sessionsLines,
      '',
      '### HISTORICAL NARRATIVE — compressed memory of past conversations.',
      '### May be out of date. If it references a different program, PRs, or body stats',
      '### than the GROUND TRUTH above, trust the ground truth.',
      '',
      '## Rolling summary',
      summary || '(empty — this is one of the first sessions)',
      '',
      '## Recent decisions',
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

  /** Programs change the entire skeleton of the athlete's week. A
   * summary that mentions the old program structure goes immediately
   * stale — and the coach can't tell whether "the 5-day split" in
   * the narrative refers to the now-replaced program or the new one.
   *
   * Easier than teaching everyone to distrust the summary: wipe it.
   * It rebuilds naturally from the next coach turns, this time under
   * the updated summarizer prompt (no program specifics persisted). */
  @OnEvent(ProgramEvents.Created)
  @OnEvent(ProgramEvents.Updated)
  @OnEvent(ProgramEvents.Deleted)
  async onProgramChanged(payload: { userId?: number }): Promise<void> {
    if (!payload?.userId) return;
    try {
      await this.contextModel.update(
        { rollingSummary: null, summaryStale: false, messagesSinceSummary: 0 },
        { where: { userId: payload.userId } },
      );
    } catch (err) {
      this.logger.warn(
        `program-change summary wipe failed for userId=${payload.userId}: ${(err as Error).message}`,
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

  private async latestMeasurement(userId: number): Promise<BodyMeasurement | null> {
    return this.measurementModel.findOne({
      where: { userId },
      order: [['date', 'DESC']],
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
    lines.push(`- Days/week available: ${profile.trainingDaysPerWeek ?? 'not set'}`);
    lines.push(
      `- Equipment: ${(profile.equipment?.length ?? 0) > 0 ? profile.equipment!.join(', ') : 'not set'}`,
    );
    lines.push(`- Sex: ${profile.sex ?? 'not set'}`);
    const age = this.ageFromDob(profile.dateOfBirth);
    lines.push(`- Age: ${age != null ? `${age} y` : 'not set'}`);
    lines.push(
      `- Height: ${profile.heightCm != null ? `${profile.heightCm} cm` : 'not set'}`,
    );
    return lines;
  }

  private formatHealth(profile: CoachProfile): string[] {
    const lines: string[] = [];
    const injuries =
      (profile.injuries?.length ?? 0) > 0
        ? profile.injuries!.join('; ')
        : 'none reported';
    lines.push(`- Injuries: ${injuries}`);
    const notes = profile.healthNotes?.trim();
    lines.push(`- Health notes: ${notes || 'none reported'}`);
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

  private formatProgram(program: Program | null, todayDow: string): string[] {
    if (!program) return ['  - (no program yet)'];
    const lines: string[] = [`  - ${program.name ?? 'Program'} · v${program.version}`];
    const days = [...(program.days ?? [])].sort((a, b) => {
      const ai = DAYS_ORDER.indexOf((a.day ?? '').toLowerCase());
      const bi = DAYS_ORDER.indexOf((b.day ?? '').toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    for (const day of days) {
      const key = (day.day ?? '').toLowerCase();
      const idx = DAYS_ORDER.indexOf(key);
      const dow = idx >= 0 ? SHORT_DOW[idx] : day.day ?? '?';
      const marker = key === todayDow ? ' ← today' : '';
      if (day.isRest) {
        lines.push(`  - ${dow}: rest${marker}`);
        continue;
      }
      const exs = (day.exercises ?? [])
        .map((e) => `${e.exercise?.name ?? '?'}×${e.sets ?? '?'}`)
        .join(', ');
      lines.push(`  - ${dow}: ${exs || '(no exercises)'}${marker}`);
    }
    return lines;
  }

  private formatTodaysPlan(program: Program | null, todayDow: string): string {
    if (!program) return 'no program configured';
    const day = (program.days ?? []).find(
      (d) => (d.day ?? '').toLowerCase() === todayDow,
    );
    if (!day) return 'no day defined for today — athlete can pick any session or rest';
    if (day.isRest) return 'rest day';
    const exs = (day.exercises ?? [])
      .map((e) => `${e.exercise?.name ?? '?'}×${e.sets ?? '?'}`)
      .join(', ');
    return exs || 'no exercises configured';
  }

  private formatContextMoment(tz: string): {
    date: string;
    time: string;
    dowKey: string;
    dowLabel: string;
    partOfDay: string;
  } {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'long',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const weekday = get('weekday');
    const date = `${get('year')}-${get('month')}-${get('day')}`;
    const time = `${get('hour')}:${get('minute')}`;
    const hourNum = Number(get('hour')) || 0;
    const partOfDay =
      hourNum < 5
        ? 'late night'
        : hourNum < 12
          ? 'morning'
          : hourNum < 17
            ? 'afternoon'
            : hourNum < 22
              ? 'evening'
              : 'night';
    return {
      date,
      time,
      dowKey: weekday.toLowerCase(),
      dowLabel: weekday,
      partOfDay,
    };
  }

  private formatLatestMeasurement(m: BodyMeasurement | null): string[] {
    if (!m) return ['  - (no body measurements logged yet)'];
    const fields: Array<[string, unknown]> = [
      ['Weight', m.weight],
      ['Shoulders', m.shoulders],
      ['Chest', m.chest],
      ['Arm', m.arm],
      ['Waist', m.waist],
      ['Abs', m.abs],
      ['Glutes', m.glutes],
      ['Thigh', m.thigh],
      ['Calf', m.calf],
    ];
    const present = fields
      .filter(([, v]) => v != null)
      .map(
        ([k, v]) =>
          `${k} ${Number(v).toFixed(1)} ${k === 'Weight' ? 'kg' : 'cm'}`,
      );
    if (present.length === 0) return [`  - (entry on ${m.date} has no values)`];
    return [`  - ${m.date}: ${present.join(' · ')}`];
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
