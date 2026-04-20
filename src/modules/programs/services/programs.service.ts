import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { CreateProgramDto } from '../dto/create-program.dto';
import { ProgramEvents, ProgramMutatedPayload } from '../events/program.events';
import { ProgramDay } from '../models/program-day.model';
import { ProgramExercise } from '../models/program-exercise.model';
import { Program } from '../models/program.model';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectModel(Program) private readonly programModel: typeof Program,
    @InjectModel(ProgramDay) private readonly programDayModel: typeof ProgramDay,
    @InjectModel(ProgramExercise)
    private readonly programExerciseModel: typeof ProgramExercise,
    private readonly sequelize: Sequelize,
    private readonly events: EventEmitter2,
  ) {}

  getVersions(userId: number): Promise<Program[]> {
    return this.programModel.findAll({
      where: { userId },
      attributes: {
        include: [[fn('COUNT', col('days.id')), 'dayCount']],
      },
      include: [{ model: ProgramDay, attributes: [] }],
      group: ['Program.id'],
      order: [['version', 'DESC']],
    });
  }

  async getCurrent(userId: number): Promise<Program> {
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
    if (!program) throw new NotFoundException('No program found');
    return program;
  }

  async getById(userId: number, id: number): Promise<Program> {
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
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  async create(userId: number, data: CreateProgramDto): Promise<Program> {
    const created = await this.sequelize.transaction(async (transaction) => {
      const lastProgram = await this.programModel.findOne({
        where: { userId },
        order: [['version', 'DESC']],
        transaction,
      });

      const version = lastProgram ? lastProgram.version + 1 : 1;

      const program = await this.programModel.create(
        { userId, name: data.name, version } as Partial<Program>,
        { transaction },
      );

      for (const dayData of data.days) {
        const day = await this.programDayModel.create(
          {
            programId: program.id,
            day: dayData.day,
            isRest: dayData.isRest,
          } as Partial<ProgramDay>,
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
              } as Partial<ProgramExercise>,
              { transaction },
            );
          }
        }
      }

      return program;
    });

    this.events.emit(ProgramEvents.Created, {
      userId,
      programId: created.id,
    } satisfies ProgramMutatedPayload);

    return this.getById(userId, created.id);
  }

  async remove(userId: number, id: number): Promise<void> {
    const program = await this.programModel.findOne({ where: { id, userId } });
    if (!program) throw new NotFoundException('Program not found');
    await program.destroy();
    this.events.emit(ProgramEvents.Deleted, { userId, programId: id });
  }
}
