import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { Transaction } from 'sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { MeasurementPhoto } from '@modules/measurements/models/measurement-photo.model';
import { ProgramDay } from '@modules/programs/models/program-day.model';
import { ProgramExercise } from '@modules/programs/models/program-exercise.model';
import { Program } from '@modules/programs/models/program.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import { ImportBackupDto } from '../dto/import.dto';

interface V1ExerciseShape {
  id?: number;
  name?: string;
}

interface V1ReferencingItem {
  exercise?: string;
  exercise_id?: number;
  exerciseId?: number;
}

@Injectable()
export class BackupService {
  constructor(
    @InjectModel(Exercise) private readonly exerciseModel: typeof Exercise,
    @InjectModel(TrainingLog) private readonly trainingLogModel: typeof TrainingLog,
    @InjectModel(BodyMeasurement)
    private readonly measurementModel: typeof BodyMeasurement,
    @InjectModel(Program) private readonly programModel: typeof Program,
    @InjectModel(ProgramDay) private readonly programDayModel: typeof ProgramDay,
    @InjectModel(ProgramExercise)
    private readonly programExerciseModel: typeof ProgramExercise,
    private readonly sequelize: Sequelize,
  ) {}

  async exportAll(userId: number) {
    const [exercises, workouts, measurements, programs] = await Promise.all([
      this.exerciseModel.findAll({ where: { userId }, raw: true }),
      this.trainingLogModel.findAll({
        where: { userId },
        include: [{ model: Exercise, attributes: ['name'] }],
        order: [['date', 'ASC']],
      }),
      this.measurementModel.findAll({
        where: { userId },
        include: [{ model: MeasurementPhoto }],
        order: [['date', 'ASC']],
      }),
      this.programModel.findAll({
        where: { userId },
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
        order: [['version', 'DESC']],
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      exercises,
      workouts,
      measurements,
      programs,
    };
  }

  async importFromV1(userId: number, data: ImportBackupDto) {
    return this.sequelize.transaction(async (transaction) => {
      const exerciseMap = new Map<string, number>();
      const oldIdToName = new Map<number, string>();
      const stats = { exercises: 0, workouts: 0, measurements: 0, programs: 0 };

      if (data.exercises?.length) {
        for (const raw of data.exercises) {
          const ex = raw as V1ExerciseShape;
          if (!ex?.name) continue;
          if (ex.id) oldIdToName.set(ex.id, ex.name);

          let exercise = await this.exerciseModel.findOne({
            where: { userId, name: ex.name },
            transaction,
          });
          if (!exercise) {
            exercise = await this.exerciseModel.create(
              { userId, name: ex.name } as Partial<Exercise>,
              { transaction },
            );
            stats.exercises++;
          }
          exerciseMap.set(ex.name, exercise.id);
        }
      }

      const resolveExerciseId = async (item: V1ReferencingItem): Promise<number | null> => {
        if (item.exercise && exerciseMap.has(item.exercise)) {
          return exerciseMap.get(item.exercise)!;
        }
        const oldId = item.exercise_id ?? item.exerciseId;
        if (oldId && oldIdToName.has(oldId)) {
          const name = oldIdToName.get(oldId)!;
          if (exerciseMap.has(name)) return exerciseMap.get(name)!;
        }
        if (item.exercise) {
          let exercise = await this.exerciseModel.findOne({
            where: { userId, name: item.exercise },
            transaction,
          });
          if (!exercise) {
            exercise = await this.exerciseModel.create(
              { userId, name: item.exercise } as Partial<Exercise>,
              { transaction },
            );
            stats.exercises++;
          }
          exerciseMap.set(item.exercise, exercise.id);
          return exercise.id;
        }
        return null;
      };

      if (data.workouts?.length) {
        for (const raw of data.workouts) {
          const w = raw as V1ReferencingItem & {
            date?: string;
            set_number?: number;
            setNumber?: number;
            reps?: number;
            weight?: number;
            rir?: number;
          };
          const exerciseId = await resolveExerciseId(w);
          if (!exerciseId || !w.date || w.reps == null || w.weight == null) continue;

          await this.trainingLogModel.create(
            {
              userId,
              date: w.date,
              exerciseId,
              setNumber: w.set_number ?? w.setNumber ?? 1,
              reps: w.reps,
              weight: w.weight,
              rir: w.rir ?? null,
            } as Partial<TrainingLog>,
            { transaction },
          );
          stats.workouts++;
        }
      }

      if (data.measurements?.length) {
        for (const raw of data.measurements) {
          const m = raw as Partial<BodyMeasurement>;
          if (!m.date) continue;
          await this.measurementModel.create({ userId, ...m } as Partial<BodyMeasurement>, {
            transaction,
          });
          stats.measurements++;
        }
      }

      if (data.programs?.length) {
        await this.importPrograms(
          userId,
          data.programs,
          { exerciseMap, oldIdToName, stats, resolveExerciseId },
          transaction,
        );
      }

      return { message: 'Import completed', stats };
    });
  }

  private async importPrograms(
    userId: number,
    rawPrograms: unknown[],
    ctx: {
      exerciseMap: Map<string, number>;
      oldIdToName: Map<number, string>;
      stats: { exercises: number; workouts: number; measurements: number; programs: number };
      resolveExerciseId: (item: V1ReferencingItem) => Promise<number | null>;
    },
    transaction: Transaction,
  ): Promise<void> {
    const lastProgram = await this.programModel.findOne({
      where: { userId },
      order: [['version', 'DESC']],
      transaction,
    });
    let nextVersion = lastProgram ? lastProgram.version + 1 : 1;

    for (const raw of rawPrograms) {
      const p = raw as {
        name?: string;
        days?: Array<{
          day?: string;
          isRest?: boolean;
          is_rest?: boolean;
          exercises?: Array<
            V1ReferencingItem & {
              sets?: number;
              sort_order?: number;
              sortOrder?: number;
            }
          >;
        }>;
      };
      const programDays = p.days ?? [];
      const program = await this.programModel.create(
        {
          userId,
          name: p.name || `Program v${nextVersion}`,
          version: nextVersion++,
        } as Partial<Program>,
        { transaction },
      );

      for (const dayData of programDays) {
        if (!dayData.day) continue;
        const isRest = dayData.isRest ?? dayData.is_rest ?? false;
        const day = await this.programDayModel.create(
          { programId: program.id, day: dayData.day, isRest } as Partial<ProgramDay>,
          { transaction },
        );

        if (!isRest && dayData.exercises?.length) {
          for (let i = 0; i < dayData.exercises.length; i++) {
            const ex = dayData.exercises[i];
            let exerciseId: number | null = null;
            const oldExId = ex.exercise_id ?? ex.exerciseId;
            if (oldExId && ctx.oldIdToName.has(oldExId)) {
              const name = ctx.oldIdToName.get(oldExId)!;
              exerciseId = ctx.exerciseMap.get(name) ?? null;
            }
            if (!exerciseId && ex.exercise) {
              exerciseId = await ctx.resolveExerciseId(ex);
            }
            if (!exerciseId) continue;

            await this.programExerciseModel.create(
              {
                programDayId: day.id,
                exerciseId,
                sets: ex.sets ?? 3,
                sortOrder: ex.sort_order ?? ex.sortOrder ?? i,
              } as Partial<ProgramExercise>,
              { transaction },
            );
          }
        }
      }
      ctx.stats.programs++;
    }
  }
}
