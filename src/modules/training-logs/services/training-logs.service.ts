import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { col, fn, literal } from 'sequelize';
import type { WhereOptions } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { CreateTrainingLogDto } from '../dto/create-training-log.dto';
import { ListTrainingLogsDto } from '../dto/list-training-logs.dto';
import { UpdateTrainingLogDto } from '../dto/update-training-log.dto';
import {
  TrainingLogCreatedPayload,
  TrainingLogEvents,
} from '../events/training-log.events';
import { TrainingLog } from '../models/training-log.model';

export interface CreateTrainingLogResult {
  log: TrainingLog;
  isPr: boolean;
}

export interface ListTrainingLogsResult {
  data: TrainingLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class TrainingLogsService {
  constructor(
    @InjectModel(TrainingLog)
    private readonly trainingLogModel: typeof TrainingLog,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: number, data: CreateTrainingLogDto): Promise<CreateTrainingLogResult> {
    const log = await this.trainingLogModel.create({ userId, ...data } as Partial<TrainingLog>);
    const isPr = await this.checkPr(userId, data.exerciseId, data.weight, data.reps);

    this.events.emit(TrainingLogEvents.Created, {
      userId,
      logId: log.id,
      exerciseId: data.exerciseId,
      date: data.date,
      isPr,
    } satisfies TrainingLogCreatedPayload);

    return { log, isPr };
  }

  async findAll(userId: number, query: ListTrainingLogsDto): Promise<ListTrainingLogsResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: WhereOptions<TrainingLog> = { userId };
    if (query.date) where.date = query.date;
    if (query.exerciseId) where.exerciseId = query.exerciseId;

    const { rows, count } = await this.trainingLogModel.findAndCountAll({
      where,
      include: [{ model: Exercise, attributes: ['id', 'name'] }],
      offset: (page - 1) * limit,
      limit,
      order: [['createdAt', 'DESC']],
    });

    return {
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  getProgress(userId: number, exerciseId: number) {
    return this.trainingLogModel.findAll({
      where: { userId, exerciseId },
      attributes: [
        'date',
        [fn('MAX', col('weight')), 'maxWeight'],
        [fn('MAX', col('reps')), 'maxReps'],
        [fn('SUM', literal('"reps" * "weight"')), 'totalVolume'],
      ],
      group: ['date'],
      order: [['date', 'ASC']],
      raw: true,
    });
  }

  async update(
    userId: number,
    id: number,
    data: UpdateTrainingLogDto,
  ): Promise<TrainingLog> {
    const log = await this.trainingLogModel.findOne({ where: { id, userId } });
    if (!log) throw new NotFoundException('Training log not found');
    await log.update(data);
    this.events.emit(TrainingLogEvents.Updated, { userId, logId: id });
    return log;
  }

  async remove(userId: number, id: number): Promise<void> {
    const log = await this.trainingLogModel.findOne({ where: { id, userId } });
    if (!log) throw new NotFoundException('Training log not found');
    await log.destroy();
    this.events.emit(TrainingLogEvents.Deleted, { userId, logId: id });
  }

  async exportCsv(userId: number): Promise<string> {
    const logs = await this.trainingLogModel.findAll({
      where: { userId },
      include: [{ model: Exercise, attributes: ['name'] }],
      order: [
        ['date', 'ASC'],
        ['exerciseId', 'ASC'],
        ['setNumber', 'ASC'],
      ],
    });

    const header = 'date,exercise,setNumber,reps,weight,rir';
    const rows = logs.map(
      (l) =>
        `${l.date},${l.exercise?.name ?? ''},${l.setNumber},${l.reps},${l.weight},${l.rir ?? ''}`,
    );
    return [header, ...rows].join('\n');
  }

  private async checkPr(
    userId: number,
    exerciseId: number,
    weight: number,
    reps: number,
  ): Promise<boolean> {
    const [maxWeight, maxReps] = await Promise.all([
      this.trainingLogModel.max<number, TrainingLog>('weight', {
        where: { userId, exerciseId },
      }),
      this.trainingLogModel.max<number, TrainingLog>('reps', {
        where: { userId, exerciseId },
      }),
    ]);
    return (
      (maxWeight != null && weight > Number(maxWeight)) ||
      (maxReps != null && reps > Number(maxReps))
    );
  }
}
