import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import {
  AppleHealthIngestData,
  AppleHealthIngestDto,
  HealthSampleDto,
} from '../dto/apple-health-ingest.dto';
import { ActivitySample } from '../models/activity-sample.model';
import { HealthSample } from '../models/health-sample.model';
import { SyncConnection } from '../models/sync-connection.model';
import { SyncLog, type SyncLogStatus } from '../models/sync-log.model';

const PROVIDER = 'apple_health' as const;

export interface IngestCounts {
  sleep: number;
  restingHr: number;
  hrv: number;
  activeEnergy: number;
  steps: number;
  workouts: number;
}

@Injectable()
export class AppleHealthService {
  private readonly logger = new Logger(AppleHealthService.name);

  constructor(
    @InjectModel(SyncConnection)
    private readonly connectionModel: typeof SyncConnection,
    @InjectModel(HealthSample)
    private readonly sampleModel: typeof HealthSample,
    @InjectModel(ActivitySample)
    private readonly activityModel: typeof ActivitySample,
    @InjectModel(SyncLog)
    private readonly syncLogModel: typeof SyncLog,
  ) {}

  /** Persist an audit row for every ingest attempt (success or fail)
   * so we can debug missing syncs after Heroku log retention expires. */
  async recordLog(entry: {
    userId: number | null;
    status: SyncLogStatus;
    payloadBytes?: number | null;
    counts?: Readonly<Record<string, number>>;
    durationMs?: number | null;
    error?: string | null;
    ip?: string | null;
  }): Promise<void> {
    try {
      await this.syncLogModel.create({
        userId: entry.userId ?? null,
        provider: PROVIDER,
        status: entry.status,
        payloadBytes: entry.payloadBytes ?? null,
        counts: { ...(entry.counts ?? {}) },
        durationMs: entry.durationMs ?? null,
        error: entry.error ?? null,
        ip: entry.ip ?? null,
      } as Partial<SyncLog>);
    } catch (err) {
      this.logger.warn(
        `failed to persist SyncLog: ${(err as Error).message}`,
      );
    }
  }

  /** Idempotent: re-calling returns the existing token. Revoke +
   * reconnect is how the athlete rotates the token. */
  async connect(userId: number): Promise<{ token: string; connectedAt: Date }> {
    const existing = await this.connectionModel.findOne({
      where: { userId, provider: PROVIDER },
    });
    if (existing && !existing.revokedAt && existing.token) {
      return { token: existing.token, connectedAt: existing.connectedAt };
    }
    const token = `ah_${randomBytes(24).toString('hex')}`;
    if (existing) {
      existing.token = token;
      existing.revokedAt = null;
      existing.connectedAt = new Date();
      await existing.save();
      return { token, connectedAt: existing.connectedAt };
    }
    const row = await this.connectionModel.create({
      userId,
      provider: PROVIDER,
      token,
      connectedAt: new Date(),
    } as Partial<SyncConnection>);
    return { token, connectedAt: row.connectedAt };
  }

  async disconnect(userId: number): Promise<void> {
    await this.connectionModel.update(
      { token: null, revokedAt: new Date() },
      { where: { userId, provider: PROVIDER } },
    );
  }

  async status(userId: number): Promise<{
    connected: boolean;
    connectedAt: Date | null;
    lastSyncAt: Date | null;
  }> {
    const row = await this.connectionModel.findOne({
      where: { userId, provider: PROVIDER },
    });
    if (!row || row.revokedAt || !row.token) {
      return { connected: false, connectedAt: null, lastSyncAt: null };
    }
    return {
      connected: true,
      connectedAt: row.connectedAt,
      lastSyncAt: row.lastSyncAt,
    };
  }

  async ingest(
    userId: number,
    dto: AppleHealthIngestDto,
  ): Promise<IngestCounts> {
    const data = dto.data;
    const counts: IngestCounts = {
      sleep: 0,
      restingHr: 0,
      hrv: 0,
      activeEnergy: 0,
      steps: 0,
      workouts: 0,
    };

    if (data.sleep?.length) {
      counts.sleep = await this.upsertSamples(
        userId,
        'sleep_duration',
        data.sleep,
      );
    }
    if (data.restingHr?.length) {
      counts.restingHr = await this.upsertSamples(
        userId,
        'resting_hr',
        data.restingHr,
      );
    }
    if (data.hrv?.length) {
      counts.hrv = await this.upsertSamples(userId, 'hrv_sdnn', data.hrv);
    }
    if (data.activeEnergy?.length) {
      counts.activeEnergy = await this.upsertSamples(
        userId,
        'active_energy',
        data.activeEnergy,
      );
    }
    if (data.steps?.length) {
      counts.steps = await this.upsertSamples(userId, 'steps', data.steps);
    }
    if (data.workouts?.length) {
      counts.workouts = await this.upsertWorkouts(userId, data.workouts);
    }

    await this.connectionModel.update(
      { lastSyncAt: new Date() },
      { where: { userId, provider: PROVIDER } },
    );

    this.logger.log(
      `apple-health sync userId=${userId} ` +
        Object.entries(counts)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}=${v}`)
          .join(' '),
    );

    return counts;
  }

  private async upsertSamples(
    userId: number,
    metric: string,
    samples: HealthSampleDto[],
  ): Promise<number> {
    let count = 0;
    for (const s of samples) {
      const startDate = new Date(s.startDate);
      const endDate = s.endDate ? new Date(s.endDate) : null;
      const [, created] = await this.sampleModel.findOrCreate({
        where: { userId, metric, startDate },
        defaults: {
          userId,
          metric,
          startDate,
          endDate,
          value: s.value,
          unit: s.unit ?? null,
          source: PROVIDER,
        } as Partial<HealthSample>,
      });
      if (created) count += 1;
    }
    return count;
  }

  private async upsertWorkouts(
    userId: number,
    workouts: AppleHealthIngestData['workouts'],
  ): Promise<number> {
    if (!workouts) return 0;
    let count = 0;
    for (const w of workouts) {
      const startDate = new Date(w.startDate);
      const endDate = w.endDate ? new Date(w.endDate) : null;
      const kind = (w.kind ?? 'unknown').toLowerCase();
      const [row, created] = await this.activityModel.findOrCreate({
        where: { userId, kind, startDate },
        defaults: {
          userId,
          kind,
          startDate,
          endDate,
          duration: w.duration ?? null,
          energy: w.energy ?? null,
          distance: w.distance ?? null,
          avgHr: w.avgHr ?? null,
          maxHr: w.maxHr ?? null,
          source: PROVIDER,
        } as Partial<ActivitySample>,
      });
      if (created) {
        count += 1;
      } else {
        // Update in place — later re-syncs may carry richer data
        // (Apple sometimes back-fills energy or HR minutes after the
        // session ends).
        row.endDate = endDate;
        if (w.duration != null) row.duration = w.duration;
        if (w.energy != null) row.energy = w.energy;
        if (w.distance != null) row.distance = w.distance;
        if (w.avgHr != null) row.avgHr = w.avgHr;
        if (w.maxHr != null) row.maxHr = w.maxHr;
        await row.save();
      }
    }
    return count;
  }
}
