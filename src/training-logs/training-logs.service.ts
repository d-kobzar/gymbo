import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col, literal } from 'sequelize';
import { TrainingLog } from './training-log.model';
import { Exercise } from '@modules/exercises/models/exercise.model';

interface CreateLogDto {
  date: string;
  exerciseId: number;
  setNumber: number;
  reps: number;
  weight: number;
  rir?: number;
}

interface LogQuery {
  page?: number;
  limit?: number;
  date?: string;
  exerciseId?: number;
}

@Injectable()
export class TrainingLogsService {
  constructor(
    @InjectModel(TrainingLog)
    private readonly trainingLogModel: typeof TrainingLog,
    @InjectModel(Exercise)
    private readonly exerciseModel: typeof Exercise,
  ) {}

  async create(
    userId: number,
    data: CreateLogDto,
  ): Promise<{ log: TrainingLog; isPr: boolean }> {
    const log = await this.trainingLogModel.create({ userId, ...data });
    const isPr = await this.checkPr(
      userId,
      data.exerciseId,
      data.weight,
      data.reps,
    );
    return { log, isPr };
  }

  async findAll(userId: number, query: LogQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { userId };

    if (query.date) {
      where.date = query.date;
    }
    if (query.exerciseId) {
      where.exerciseId = query.exerciseId;
    }

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

  async getProgress(userId: number, exerciseId: number) {
    const logs = await this.trainingLogModel.findAll({
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

    return logs;
  }

  async update(
    userId: number,
    id: number,
    data: Partial<CreateLogDto>,
  ): Promise<TrainingLog> {
    const log = await this.trainingLogModel.findOne({ where: { id, userId } });
    if (!log) {
      throw new NotFoundException('Training log not found');
    }
    await log.update(data);
    return log;
  }

  async remove(userId: number, id: number): Promise<void> {
    const log = await this.trainingLogModel.findOne({ where: { id, userId } });
    if (!log) {
      throw new NotFoundException('Training log not found');
    }
    await log.destroy();
  }

  async exportCsv(userId: number): Promise<string> {
    const logs = await this.trainingLogModel.findAll({
      where: { userId },
      include: [{ model: Exercise, attributes: ['name'] }],
      order: [['date', 'ASC'], ['exerciseId', 'ASC'], ['setNumber', 'ASC']],
    });

    const header = 'date,exercise,setNumber,reps,weight,rir';
    const rows = logs.map(
      (l) =>
        `${l.date},${l.exercise?.name ?? ''},${l.setNumber},${l.reps},${l.weight},${l.rir ?? ''}`,
    );

    return [header, ...rows].join('\n');
  }

  async checkPr(
    userId: number,
    exerciseId: number,
    weight: number,
    reps: number,
  ): Promise<boolean> {
    const maxWeight = await this.trainingLogModel.max('weight', {
      where: { userId, exerciseId },
    });

    const maxReps = await this.trainingLogModel.max('reps', {
      where: { userId, exerciseId },
    });

    return (
      (maxWeight !== null && weight > Number(maxWeight)) ||
      (maxReps !== null && reps > Number(maxReps))
    );
  }
}
