import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col, literal } from 'sequelize';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import { BodyMeasurement } from '../measurements/body-measurement.model';
import { Exercise } from '@modules/exercises/models/exercise.model';

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

  async getDashboard(userId: number) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek.toISOString().split('T')[0];

    const setsThisWeek = await this.trainingLogModel.count({
      where: {
        userId,
        date: { [Op.gte]: weekStart },
      },
    });

    const totalSets = await this.trainingLogModel.count({
      where: { userId },
    });

    const latestMeasurement = await this.measurementModel.findOne({
      where: { userId },
      order: [['date', 'DESC']],
      attributes: ['weight'],
    });

    const exerciseCount = await this.exerciseModel.count({
      where: { userId },
    });

    const workoutDays = await this.trainingLogModel.count({
      where: { userId },
      distinct: true,
      col: 'date',
    });

    return {
      setsThisWeek,
      totalSets,
      bodyWeight: latestMeasurement?.weight ?? null,
      exerciseCount,
      workoutDays,
    };
  }

  async getPersonalRecords(userId: number) {
    const prs = await this.trainingLogModel.findAll({
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

    return prs;
  }

  async getCalendar(userId: number, year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const days = await this.trainingLogModel.findAll({
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

    return days;
  }

  async getVolume(userId: number, weeks: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);
    const start = startDate.toISOString().split('T')[0];

    const volume = await this.trainingLogModel.findAll({
      where: {
        userId,
        date: { [Op.gte]: start },
      },
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

    return volume;
  }
}
