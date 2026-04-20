import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, col, fn, literal } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';

export interface DashboardSummary {
  setsThisWeek: number;
  totalSets: number;
  bodyWeight: number | null;
  exerciseCount: number;
  workoutDays: number;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(TrainingLog)
    private readonly trainingLogModel: typeof TrainingLog,
    @InjectModel(BodyMeasurement)
    private readonly measurementModel: typeof BodyMeasurement,
    @InjectModel(Exercise)
    private readonly exerciseModel: typeof Exercise,
  ) {}

  async getDashboard(userId: number): Promise<DashboardSummary> {
    const weekStart = this.weekStartIso();

    const [setsThisWeek, totalSets, latestMeasurement, exerciseCount, workoutDays] =
      await Promise.all([
        this.trainingLogModel.count({
          where: { userId, date: { [Op.gte]: weekStart } },
        }),
        this.trainingLogModel.count({ where: { userId } }),
        this.measurementModel.findOne({
          where: { userId },
          order: [['date', 'DESC']],
          attributes: ['weight'],
        }),
        this.exerciseModel.count({ where: { userId } }),
        this.trainingLogModel.count({
          where: { userId },
          distinct: true,
          col: 'date',
        }),
      ]);

    return {
      setsThisWeek,
      totalSets,
      bodyWeight: latestMeasurement?.weight ?? null,
      exerciseCount,
      workoutDays,
    };
  }

  getPersonalRecords(userId: number) {
    return this.trainingLogModel.findAll({
      where: { userId },
      attributes: [
        'exerciseId',
        [fn('MAX', col('weight')), 'maxWeight'],
        [fn('MAX', col('reps')), 'maxReps'],
        [fn('MAX', literal('"reps" * "weight"')), 'maxVolume'],
      ],
      include: [{ model: Exercise, attributes: ['name'] }],
      group: ['exerciseId', 'exercise.id'],
      raw: true,
      nest: true,
    });
  }

  getCalendar(userId: number, year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    return this.trainingLogModel.findAll({
      where: {
        userId,
        date: { [Op.gte]: startDate, [Op.lt]: endDate },
      },
      attributes: [
        'date',
        [fn('COUNT', col('id')), 'sets'],
        [fn('COUNT', fn('DISTINCT', col('exerciseId'))), 'exercises'],
      ],
      group: ['date'],
      order: [['date', 'ASC']],
      raw: true,
    });
  }

  getVolume(userId: number, weeks: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);
    const start = startDate.toISOString().split('T')[0];

    return this.trainingLogModel.findAll({
      where: { userId, date: { [Op.gte]: start } },
      attributes: [
        'exerciseId',
        [fn('SUM', literal('"reps" * "weight"')), 'totalVolume'],
      ],
      include: [{ model: Exercise, attributes: ['name'] }],
      group: ['exerciseId', 'exercise.id'],
      order: [[literal('"totalVolume"'), 'DESC']],
      raw: true,
      nest: true,
    });
  }

  private weekStartIso(): string {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start.toISOString().split('T')[0];
  }
}
