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
import type { LlmMessage } from '@modules/llm/llm-provider.interface';
import {
  countMessagesTokens,
  countTextTokens,
} from '@shared/utils/token-counter';
import {
  CoachContext,
  CoachDecision,
  CoachProfile,
} from '../models/coach-context.model';
import { CoachMessage } from '../models/coach-message.model';

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
 * Owns the hybrid rolling-window memory for the coach.
 *
 * Two persisted layers: `entityMap` (structured facts) and
 * `rollingSummary` (textual narrative), both updated by the
 * background memory worker from the Active Buffer — messages with
 * summaryStatus='none'.
 *
 * The public surface:
 *   - composeContext(userId): returns { instructions, messages } —
 *     the full payload the agent hands to LlmProvider.
 *   - countBufferTokens(userId): drives the token-based summarizer
 *     trigger.
 *   - applyMemoryUpdate(userId, entityMap, summary, ids): atomic
 *     write of both memory layers + flipping processed messages.
 *   - loadActiveBuffer(userId): raw verbatim messages pending fold.
 *
 * Subscribes to TrainingLog / Measurement / Program events so the
 * stale flag flips the moment the athlete logs anything, and wipes
 * the running summary when the program changes so old structural
 * references can't seep forward through paraphrase.
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
    @InjectModel(CoachMessage)
    private readonly messageModel: typeof CoachMessage,
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

  /**
   * Atomically persist both halves of the memory layer — structured
   * entityMap and textual running summary — and mark the processed
   * messages as folded in. Called by the background memory worker
   * after it rewrites the narrative. The ids array is the subset of
   * the Active Buffer that was actually summarized (typically all
   * but the last 3, to preserve the current conversation thread).
   */
  async applyMemoryUpdate(
    userId: number,
    entityMap: Record<string, unknown>,
    summary: string,
    processedMessageIds: number[],
  ): Promise<void> {
    const sequelize = this.messageModel.sequelize;
    if (!sequelize) throw new Error('Sequelize instance not available');

    await sequelize.transaction(async (t) => {
      await this.contextModel.update(
        {
          entityMap,
          rollingSummary: summary,
          messagesSinceSummary: 0,
          summaryStale: false,
        },
        { where: { userId }, transaction: t },
      );
      if (processedMessageIds.length > 0) {
        await this.messageModel.update(
          { summaryStatus: 'processed', summarizedAt: new Date() },
          {
            where: {
              id: { [Op.in]: processedMessageIds },
              summaryStatus: 'none',
            },
            transaction: t,
          },
        );
      }
    });
  }

  /** Backwards-compat shim used by `RollingSummaryService.refresh()`. */
  async applyRegeneratedSummary(userId: number, summary: string): Promise<void> {
    await this.contextModel.update(
      { rollingSummary: summary, messagesSinceSummary: 0, summaryStale: false },
      { where: { userId } },
    );
  }

  /**
   * Active Buffer — raw, chronologically-ordered user and assistant
   * messages that have not yet been folded into the running summary.
   * This is the conversation the coach actually sees each turn.
   */
  async loadActiveBuffer(userId: number): Promise<CoachMessage[]> {
    return this.messageModel.findAll({
      where: { userId, summaryStatus: 'none' },
      order: [['createdAt', 'ASC']],
    });
  }

  /** Token count for the Active Buffer — drives the summarizer
   * trigger (fires when the buffer crosses the configured threshold). */
  async countBufferTokens(userId: number): Promise<number> {
    const buffer = await this.loadActiveBuffer(userId);
    return countMessagesTokens(
      buffer.map((m) => ({ role: m.role, content: m.content })),
    );
  }

  /**
   * Compose the full request payload for an LLM turn. Returns both
   * halves the agent needs to call the provider:
   *
   *   - `instructions`: static system prompt (ASSISTANT_INSTRUCTIONS)
   *     + stable ground-truth block (Context moment, profile, health,
   *     live metrics, latest body snapshot, current program, last 3
   *     sessions) + current entityMap JSON. Prompt-cache friendly:
   *     the static prefix changes only when athlete facts change.
   *
   *   - `messages`: an optional pseudo-assistant turn carrying the
   *     running summary, followed by the Active Buffer in
   *     chronological order. The caller does NOT append the "current
   *     user message" — it is already in the buffer (MessageQueue
   *     writes it before invoking the agent).
   */
  async composeContext(userId: number): Promise<{
    instructions: string;
    messages: LlmMessage[];
  }> {
    const ctx = await this.getOrCreate(userId);
    const [staticContext, buffer] = await Promise.all([
      this.buildStaticContextBlock(userId, ctx),
      this.loadActiveBuffer(userId),
    ]);

    const entityMap = ctx.entityMap ?? {};
    const entityMapJson = JSON.stringify(entityMap, null, 2);

    const instructions = [
      staticContext,
      '',
      '### ENTITY MAP — structured facts the memory worker keeps fresh.',
      '### Read it; do NOT echo it back to the athlete.',
      entityMapJson,
    ].join('\n');

    const messages: LlmMessage[] = [];
    const summary = ctx.rollingSummary?.trim();
    if (summary) {
      messages.push({
        role: 'assistant',
        content: `Memory recap (prior conversations — for your reference, do not quote back): ${summary}`,
      });
    }
    for (const row of buffer) {
      messages.push(
        row.role === 'assistant'
          ? { role: 'assistant', content: row.content }
          : { role: 'user', content: row.content },
      );
    }

    return { instructions, messages };
  }

  /** Token-count-only variant for the trigger decision — avoids a
   * full LLM round-trip just to decide whether to fire a summary. */
  async approxRequestTokens(userId: number): Promise<number> {
    const { instructions, messages } = await this.composeContext(userId);
    return (
      countTextTokens(instructions) +
      countMessagesTokens(
        messages.map((m) => ({
          role: m.role,
          content:
            m.role === 'tool'
              ? m.output
              : (m as { content: string }).content,
        })),
      )
    );
  }

  /** Generate only the stable ground-truth block (no entityMap,
   * no instructions, no summary) — shared by composeContext and the
   * memory-update prompt. */
  async buildStaticContextBlock(
    userId: number,
    ctxMaybe?: CoachContext,
  ): Promise<string> {
    const ctx = ctxMaybe ?? (await this.getOrCreate(userId));
    const [user, aggregates, topPrs, program, lastSessions, latestBody] =
      await Promise.all([
        this.userModel.findByPk(userId, {
          attributes: ['timezone', 'language'],
        }),
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
    const sessionsLines = this.formatLastSessions(lastSessions);
    const measurementLines = this.formatLatestMeasurement(latestBody);

    return [
      '### CONTEXT MOMENT',
      `- Local date: ${moment.date} (${moment.dowLabel})`,
      `- Local time: ${moment.time} (${moment.partOfDay})`,
      `- Timezone: ${tz}`,
      '',
      '### GROUND TRUTH — reference data only, pulled fresh every turn.',
      '### This block is NOT a template for your reply. Do not quote from it,',
      '### do not dump exercise lists, do not recap what the athlete already knows.',
      '### Use it to answer the question that was actually asked. If the latest',
      '### user message contradicts anything here, accept the user and update',
      '### your stance — do not repeat what you see here.',
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
    ].join('\n');
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
      exercises: Array<{
        name: string;
        sets: Array<{ weight: number; reps: number; rir: number | null }>;
      }>;
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

    // Preserve per-set detail — topWeight×topReps×sets aggregation
    // hides rep drop-off (12/12/8/8 looks identical to 12/12/12/12
    // when flattened), and that's exactly the signal a coach needs
    // to see to advise "hold" vs "add load".
    const byDate = new Map<
      string,
      Map<string, Array<{ weight: number; reps: number; rir: number | null }>>
    >();
    for (const l of logs) {
      const date = (l as any).date as string;
      const exName = (l as any).exercise?.name ?? `#${(l as any).exerciseId}`;
      const weight = Number((l as any).weight ?? 0);
      const reps = Number((l as any).reps ?? 0);
      const rirRaw = (l as any).rir;
      const rir = rirRaw == null ? null : Number(rirRaw);
      const byEx = byDate.get(date) ?? new Map();
      const sets = byEx.get(exName) ?? [];
      sets.push({ weight, reps, rir });
      byEx.set(exName, sets);
      byDate.set(date, byEx);
    }

    return dates.map((date) => {
      const byEx = byDate.get(date) ?? new Map();
      const exercises = Array.from(byEx.entries()).map(([name, sets]) => ({
        name,
        sets,
      }));
      const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
      const totalVolume = exercises.reduce(
        (acc, e) => acc + e.sets.reduce((s, set) => s + set.weight * set.reps, 0),
        0,
      );
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
      ['Neck', m.neck],
      ['Chest', m.chest],
      ['Arm', m.arm],
      ['Waist', m.waist],
      ['Belly', m.abs],
      ['Thigh', m.thigh],
      ['Calf', m.calf],
      ['Glutes', m.glutes],
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
      exercises: Array<{
        name: string;
        sets: Array<{ weight: number; reps: number; rir: number | null }>;
      }>;
    }>,
  ): string[] {
    if (!sessions.length) return ['  - (no sessions yet)'];
    const lines: string[] = [];
    sessions.forEach((s, idx) => {
      const volume = Math.round(s.totalVolume);
      if (idx === 0) {
        // Most recent session — full per-set breakdown so drop-offs,
        // RIR trends, and matched-weight progression are visible.
        lines.push(
          `  - ${s.date} (most recent): ${s.totalSets} sets · ${volume} kg·reps`,
        );
        for (const e of s.exercises) {
          const setList = e.sets
            .map((set) => {
              const rir = set.rir == null ? '' : ` RIR ${set.rir}`;
              return `${set.weight}×${set.reps}${rir}`;
            })
            .join(', ');
          lines.push(`    · ${e.name}: ${setList}`);
        }
      } else {
        // Older sessions — compact aggregate (top weight × top reps × total sets).
        const summary = s.exercises
          .map((e) => {
            const topWeight = e.sets.reduce((m, set) => Math.max(m, set.weight), 0);
            const topReps = e.sets.reduce((m, set) => Math.max(m, set.reps), 0);
            return `${e.name} ${topWeight}×${topReps}×${e.sets.length}`;
          })
          .join(', ');
        lines.push(
          `  - ${s.date}: ${s.totalSets} sets · ${volume} kg·reps — ${summary}`,
        );
      }
    });
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
