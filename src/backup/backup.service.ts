import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { TrainingLog } from '../training-logs/training-log.model';
import { BodyMeasurement } from '../measurements/body-measurement.model';
import { MeasurementPhoto } from '../measurements/measurement-photo.model';
import { Program } from '../programs/program.model';
import { ProgramDay } from '../programs/program-day.model';
import { ProgramExercise } from '../programs/program-exercise.model';

@Injectable()
export class BackupService {
  constructor(
    @InjectModel(Exercise) private readonly exerciseModel: typeof Exercise,
    @InjectModel(TrainingLog) private readonly trainingLogModel: typeof TrainingLog,
    @InjectModel(BodyMeasurement) private readonly measurementModel: typeof BodyMeasurement,
    @InjectModel(Program) private readonly programModel: typeof Program,
    @InjectModel(ProgramDay) private readonly programDayModel: typeof ProgramDay,
    @InjectModel(ProgramExercise) private readonly programExerciseModel: typeof ProgramExercise,
    private readonly sequelize: Sequelize,
  ) {}

  async exportAll(userId: number) {
    const exercises = await this.exerciseModel.findAll({ where: { userId }, raw: true });
    const workouts = await this.trainingLogModel.findAll({
      where: { userId },
      include: [{ model: Exercise, attributes: ['name'] }],
      order: [['date', 'ASC']],
    });
    const measurements = await this.measurementModel.findAll({
      where: { userId },
      include: [{ model: MeasurementPhoto }],
      order: [['date', 'ASC']],
    });
    const programs = await this.programModel.findAll({
      where: { userId },
      include: [{ model: ProgramDay, include: [{ model: ProgramExercise, include: [{ model: Exercise, attributes: ['name'] }] }] }],
      order: [['version', 'DESC']],
    });

    return { exportedAt: new Date().toISOString(), exercises, workouts, measurements, programs };
  }

  async importFromV1(userId: number, data: any) {
    return this.sequelize.transaction(async (transaction) => {
      const exerciseMap = new Map<string, number>();
      const oldIdToName = new Map<number, string>();
      const stats = { exercises: 0, workouts: 0, measurements: 0, programs: 0 };

      // 1. Import exercises — build both name->id and oldId->name maps
      if (data.exercises?.length) {
        for (const ex of data.exercises) {
          const name = ex.name;
          if (!name) continue;

          // Track old id -> name mapping for workout lookups
          if (ex.id) oldIdToName.set(ex.id, name);

          let exercise = await this.exerciseModel.findOne({
            where: { userId, name },
            transaction,
          });
          if (!exercise) {
            exercise = await this.exerciseModel.create({ userId, name }, { transaction });
            stats.exercises++;
          }
          exerciseMap.set(name, exercise.id);
        }
      }

      // Helper: resolve exercise id from old format
      const resolveExerciseId = async (item: any): Promise<number | null> => {
        // Try by name first (new format)
        if (item.exercise && exerciseMap.has(item.exercise)) {
          return exerciseMap.get(item.exercise)!;
        }
        // Try by old exercise_id -> name lookup
        const oldId = item.exercise_id || item.exerciseId;
        if (oldId && oldIdToName.has(oldId)) {
          const name = oldIdToName.get(oldId)!;
          if (exerciseMap.has(name)) return exerciseMap.get(name)!;
        }
        // Try by name, create if needed
        if (item.exercise) {
          let exercise = await this.exerciseModel.findOne({
            where: { userId, name: item.exercise },
            transaction,
          });
          if (!exercise) {
            exercise = await this.exerciseModel.create({ userId, name: item.exercise }, { transaction });
            stats.exercises++;
          }
          exerciseMap.set(item.exercise, exercise.id);
          return exercise.id;
        }
        return null;
      };

      // 2. Import workouts — handle both old (snake_case + exercise_id) and new formats
      if (data.workouts?.length) {
        for (const w of data.workouts) {
          const exerciseId = await resolveExerciseId(w);
          if (!exerciseId) continue;

          await this.trainingLogModel.create({
            userId,
            date: w.date,
            exerciseId,
            setNumber: w.set_number ?? w.setNumber ?? 1,
            reps: w.reps,
            weight: w.weight,
            rir: w.rir ?? null,
          }, { transaction });
          stats.workouts++;
        }
      }

      // 3. Import measurements
      if (data.measurements?.length) {
        for (const m of data.measurements) {
          await this.measurementModel.create({
            userId,
            date: m.date,
            weight: m.weight ?? null,
            shoulders: m.shoulders ?? null,
            arm: m.arm ?? null,
            chest: m.chest ?? null,
            waist: m.waist ?? null,
            abs: m.abs ?? null,
            glutes: m.glutes ?? null,
            thigh: m.thigh ?? null,
            calf: m.calf ?? null,
          }, { transaction });
          stats.measurements++;
        }
      }

      // 4. Import programs — handle both old (nested with exercise_id) and new formats
      if (data.programs?.length) {
        const lastProgram = await this.programModel.findOne({
          where: { userId },
          order: [['version', 'DESC']],
          transaction,
        });
        let nextVersion = lastProgram ? lastProgram.version + 1 : 1;

        for (const p of data.programs) {
          const programDays = p.days || [];
          const program = await this.programModel.create({
            userId,
            name: p.name || `Program v${nextVersion}`,
            version: nextVersion++,
          }, { transaction });

          for (const dayData of programDays) {
            const isRest = dayData.is_rest ?? dayData.isRest ?? false;
            const day = await this.programDayModel.create({
              programId: program.id,
              day: dayData.day,
              isRest,
            }, { transaction });

            const dayExercises = dayData.exercises || [];
            if (!isRest && dayExercises.length) {
              for (let i = 0; i < dayExercises.length; i++) {
                const ex = dayExercises[i];

                // Resolve exercise: could be { exercise_id, sets } or { exercise: "name", sets }
                let exerciseId: number | null = null;
                const oldExId = ex.exercise_id || ex.exerciseId;
                if (oldExId && oldIdToName.has(oldExId)) {
                  const name = oldIdToName.get(oldExId)!;
                  exerciseId = exerciseMap.get(name) || null;
                }
                if (!exerciseId && ex.exercise) {
                  exerciseId = await resolveExerciseId(ex);
                }
                if (!exerciseId) continue;

                await this.programExerciseModel.create({
                  programDayId: day.id,
                  exerciseId,
                  sets: ex.sets ?? 3,
                  sortOrder: ex.sort_order ?? ex.sortOrder ?? i,
                }, { transaction });
              }
            }
          }
          stats.programs++;
        }
      }

      return { message: 'Import completed', stats };
    });
  }
}
