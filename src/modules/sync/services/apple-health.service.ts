import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import {
  MeasurementCreatedPayload,
  MeasurementEvents,
} from '@modules/measurements/events/measurement.events';
import {
  AppleHealthIngestDto,
  HealthSampleDto,
} from '../dto/apple-health-ingest.dto';
import { HealthSample } from '../models/health-sample.model';
import { SyncConnection } from '../models/sync-connection.model';

const PROVIDER = 'apple_health' as const;

export interface IngestCounts {
  weights: number;
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
    @InjectModel(BodyMeasurement)
    private readonly measurementModel: typeof BodyMeasurement,
    private readonly events: EventEmitter2,
  ) {}

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
    const counts: IngestCounts = {
      weights: 0,
      sleep: 0,
      restingHr: 0,
      hrv: 0,
      activeEnergy: 0,
      steps: 0,
      workouts: 0,
    };

    if (dto.weights?.length) {
      counts.weights = await this.upsertWeights(userId, dto.weights);
    }
    if (dto.sleep?.length) {
      counts.sleep = await this.upsertSamples(
        userId,
        'sleep_duration',
        dto.sleep,
      );
    }
    if (dto.restingHr?.length) {
      counts.restingHr = await this.upsertSamples(
        userId,
        'resting_hr',
        dto.restingHr,
      );
    }
    if (dto.hrv?.length) {
      counts.hrv = await this.upsertSamples(userId, 'hrv_sdnn', dto.hrv);
    }
    if (dto.activeEnergy?.length) {
      counts.activeEnergy = await this.upsertSamples(
        userId,
        'active_energy',
        dto.activeEnergy,
      );
    }
    if (dto.steps?.length) {
      counts.steps = await this.upsertSamples(userId, 'steps', dto.steps);
    }
    if (dto.workouts?.length) {
      counts.workouts = await this.upsertWorkouts(userId, dto.workouts);
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

  private async upsertWeights(
    userId: number,
    samples: HealthSampleDto[],
  ): Promise<number> {
    let count = 0;
    for (const s of samples) {
      const date = new Date(s.startDate).toISOString().slice(0, 10);
      // Day-level idempotency: one BodyMeasurement per day, Apple's
      // sample beats nothing and is overwritten by a later sample on
      // the same day (assume newer is truer).
      const [row, created] = await this.measurementModel.findOrCreate({
        where: { userId, date },
        defaults: { userId, date, weight: s.value } as Partial<BodyMeasurement>,
      });
      if (!created) {
        row.weight = s.value;
        await row.save();
      } else {
        this.events.emit(MeasurementEvents.Created, {
          userId,
          measurementId: row.id,
          date,
        } satisfies MeasurementCreatedPayload);
      }
      count += 1;
    }
    return count;
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
    workouts: AppleHealthIngestDto['workouts'],
  ): Promise<number> {
    if (!workouts) return 0;
    let count = 0;
    for (const w of workouts) {
      const startDate = new Date(w.startDate);
      const endDate = w.endDate ? new Date(w.endDate) : null;
      // External workouts (cardio, runs, cycling from Apple Watch)
      // land in HealthSamples under the "workout_*" metric family
      // so they don't collide with our strength TrainingLog.
      const metric = `workout_${(w.kind ?? 'unknown').toLowerCase()}`;
      const [, created] = await this.sampleModel.findOrCreate({
        where: { userId, metric, startDate },
        defaults: {
          userId,
          metric,
          startDate,
          endDate,
          value: w.duration ?? 0,
          unit: 'seconds',
          source: PROVIDER,
        } as Partial<HealthSample>,
      });
      if (created) count += 1;
    }
    return count;
  }
}
