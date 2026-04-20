import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { fn, col } from 'sequelize';
import { Program } from './program.model';
import { ProgramDay } from './program-day.model';
import { ProgramExercise } from './program-exercise.model';
import { Exercise } from '../exercises/exercise.model';

interface CreateProgramDto {
  name: string;
  days: {
    day: string;
    isRest: boolean;
    exercises?: { exerciseId: number; sets: number }[];
  }[];
}

@Injectable()
export class ProgramsService {
  constructor(
    @InjectModel(Program) private readonly programModel: typeof Program,
    @InjectModel(ProgramDay) private readonly programDayModel: typeof ProgramDay,
    @InjectModel(ProgramExercise)
    private readonly programExerciseModel: typeof ProgramExercise,
    private readonly sequelize: Sequelize,
  ) {}

  async getVersions(userId: number) {
    const programs = await this.programModel.findAll({
      where: { userId },
      attributes: {
        include: [
          [fn('COUNT', col('days.id')), 'dayCount'],
        ],
      },
      include: [
        {
          model: ProgramDay,
          attributes: [],
        },
      ],
      group: ['Program.id'],
      order: [['version', 'DESC']],
    });

    return programs;
  }

  async getCurrent(userId: number) {
    const program = await this.programModel.findOne({
      where: { userId },
      order: [['version', 'DESC']],
      include: [
        {
          model: ProgramDay,
          include: [
            {
              model: ProgramExercise,
              include: [{ model: Exercise, attributes: ['id', 'name'] }],
            },
          ],
        },
      ],
    });

    if (!program) {
      throw new NotFoundException('No program found');
    }

    return program;
  }

  async getById(userId: number, id: number) {
    const program = await this.programModel.findOne({
      where: { id, userId },
      include: [
        {
          model: ProgramDay,
          include: [
            {
              model: ProgramExercise,
              include: [{ model: Exercise, attributes: ['id', 'name'] }],
            },
          ],
        },
      ],
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    return program;
  }

  async create(userId: number, data: CreateProgramDto) {
    return this.sequelize.transaction(async (transaction) => {
      const lastProgram = await this.programModel.findOne({
        where: { userId },
        order: [['version', 'DESC']],
        transaction,
      });

      const version = lastProgram ? lastProgram.version + 1 : 1;

      const program = await this.programModel.create(
        { userId, name: data.name, version },
        { transaction },
      );

      for (const dayData of data.days) {
        const day = await this.programDayModel.create(
          {
            programId: program.id,
            day: dayData.day,
            isRest: dayData.isRest,
          },
          { transaction },
        );

        if (dayData.exercises && !dayData.isRest) {
          for (let i = 0; i < dayData.exercises.length; i++) {
            const ex = dayData.exercises[i];
            await this.programExerciseModel.create(
              {
                programDayId: day.id,
                exerciseId: ex.exerciseId,
                sets: ex.sets,
                sortOrder: i,
              },
              { transaction },
            );
          }
        }
      }

      return this.getById(userId, program.id);
    });
  }

  async remove(userId: number, id: number): Promise<void> {
    const program = await this.programModel.findOne({
      where: { id, userId },
    });
    if (!program) {
      throw new NotFoundException('Program not found');
    }
    await program.destroy();
  }
}
