import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { ProgramDay } from '@modules/programs/models/program-day.model';
import { ProgramExercise } from '@modules/programs/models/program-exercise.model';
import { Program } from '@modules/programs/models/program.model';
import type { CoachTool } from '../coach-tool.interface';

@Injectable()
export class GetCurrentProgramHandler
  implements CoachTool<Record<string, never>, Program | { message: string }>
{
  readonly name = 'get_current_program';
  readonly definition = {
    name: this.name,
    description: 'Get the current training program with days and exercises',
    parameters: { type: 'object' as const, properties: {}, required: [] },
  };

  constructor(@InjectModel(Program) private readonly programModel: typeof Program) {}

  async execute(
    _params: Record<string, never>,
    userId: number,
  ): Promise<Program | { message: string }> {
    const program = await this.programModel.findOne({
      where: { userId },
      order: [['version', 'DESC']],
      include: [
        {
          model: ProgramDay,
          as: 'days',
          include: [
            {
              model: ProgramExercise,
              as: 'exercises',
              include: [Exercise],
            },
          ],
        },
      ],
    });
    return program ?? { message: 'No program found' };
  }
}
