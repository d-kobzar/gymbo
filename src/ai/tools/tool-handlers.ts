import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { Program } from '@modules/programs/models/program.model';
import { ProgramDay } from '@modules/programs/models/program-day.model';
import { ProgramExercise } from '@modules/programs/models/program-exercise.model';
import { Op, fn, col, literal } from 'sequelize';

export async function executeTool(name: string, args: any, userId: number): Promise<any> {
  switch (name) {
    case 'get_user_stats': {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const [totalSets, setsThisWeek, exerciseCount, lastMeasurement] = await Promise.all([
        TrainingLog.count({ where: { userId } }),
        TrainingLog.count({ where: { userId, createdAt: { [Op.gte]: weekStart } } }),
        Exercise.count({ where: { userId } }),
        BodyMeasurement.findOne({ where: { userId }, order: [['date', 'DESC']] }),
      ]);

      return { totalSets, setsThisWeek, exerciseCount, bodyWeight: lastMeasurement?.weight || null };
    }

    case 'get_workouts': {
      const where: any = { userId };
      if (args.date) where.date = args.date;

      if (args.exerciseName) {
        const ex = await Exercise.findOne({
          where: { userId, name: { [Op.iLike]: `%${args.exerciseName}%` } },
        });
        if (ex) where.exerciseId = ex.id;
      }

      return TrainingLog.findAll({
        where,
        include: [{ model: Exercise, attributes: ['name'] }],
        order: [['date', 'DESC'], ['setNumber', 'ASC']],
        limit: args.limit || 20,
      });
    }

    case 'get_personal_records': {
      const logs = await TrainingLog.findAll({
        where: { userId },
        include: [{ model: Exercise, attributes: ['name'] }],
        attributes: ['exerciseId', 'reps', 'weight'],
      });

      const prs: Record<string, any> = {};
      for (const log of logs) {
        const name = (log as any).Exercise?.name || `#${log.exerciseId}`;
        if (!prs[name]) prs[name] = { maxWeight: 0, maxReps: 0, maxVolume: 0 };
        prs[name].maxWeight = Math.max(prs[name].maxWeight, log.weight);
        prs[name].maxReps = Math.max(prs[name].maxReps, log.reps);
        prs[name].maxVolume = Math.max(prs[name].maxVolume, log.reps * log.weight);
      }
      return prs;
    }

    case 'get_measurements': {
      const where: any = { userId };
      return BodyMeasurement.findAll({
        where,
        order: [['date', 'DESC']],
        limit: args.limit || 10,
      });
    }

    case 'get_current_program': {
      const program = await Program.findOne({
        where: { userId },
        order: [['version', 'DESC']],
        include: [{
          model: ProgramDay,
          as: 'days',
          include: [{ model: ProgramExercise, as: 'exercises', include: [Exercise] }],
        }],
      });
      return program || { message: 'No program found' };
    }

    case 'get_exercise_progress': {
      const ex = await Exercise.findOne({
        where: { userId, name: { [Op.iLike]: `%${args.exerciseName}%` } },
      });
      if (!ex) return { message: `Exercise "${args.exerciseName}" not found` };

      return TrainingLog.findAll({
        where: { userId, exerciseId: ex.id },
        attributes: ['date', 'setNumber', 'reps', 'weight'],
        order: [['date', 'ASC'], ['setNumber', 'ASC']],
        limit: 100,
      });
    }

    case 'get_volume_analysis': {
      const weeks = args.weeks || 4;
      const since = new Date();
      since.setDate(since.getDate() - weeks * 7);

      const logs = await TrainingLog.findAll({
        where: { userId, date: { [Op.gte]: since } },
        include: [{ model: Exercise, attributes: ['name'] }],
      });

      const volume: Record<string, number> = {};
      for (const log of logs) {
        const name = (log as any).Exercise?.name || `#${log.exerciseId}`;
        volume[name] = (volume[name] || 0) + log.reps * log.weight;
      }

      return Object.entries(volume)
        .sort(([, a], [, b]) => b - a)
        .map(([name, totalVolume]) => ({ name, totalVolume }));
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
