import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { and, col, fn, where } from 'sequelize';
import { Exercise } from '../models/exercise.model';

@Injectable()
export class ExercisesService {
  constructor(@InjectModel(Exercise) private readonly exerciseModel: typeof Exercise) {}

  async create(userId: number, rawName: string): Promise<Exercise> {
    const name = (rawName ?? '').trim();
    if (!name) throw new BadRequestException('Name is required');
    if (await this.findByNameCi(userId, name)) {
      throw new ConflictException('Exercise with this name already exists');
    }
    return this.exerciseModel.create({ userId, name } as Partial<Exercise>);
  }

  findAll(userId: number): Promise<Exercise[]> {
    return this.exerciseModel.findAll({
      where: { userId },
      order: [['name', 'ASC']],
    });
  }

  async update(userId: number, id: number, rawName: string): Promise<Exercise> {
    const name = (rawName ?? '').trim();
    if (!name) throw new BadRequestException('Name is required');
    const exercise = await this.exerciseModel.findOne({ where: { id, userId } });
    if (!exercise) throw new NotFoundException('Exercise not found');

    const duplicate = await this.findByNameCi(userId, name);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictException('Exercise with this name already exists');
    }

    exercise.name = name;
    await exercise.save();
    return exercise;
  }

  async remove(userId: number, id: number): Promise<void> {
    const exercise = await this.exerciseModel.findOne({ where: { id, userId } });
    if (!exercise) throw new NotFoundException('Exercise not found');
    await exercise.destroy();
  }

  /** Case-insensitive name lookup. The DB's unique index on
   * (userId, name) is case-sensitive, so "Bench" + "bench" would both
   * pass the raw-equality check and only collide on the second insert
   * with a cryptic "Validation error". Normalize with lower() at the
   * query layer and reject at the app layer. */
  private async findByNameCi(userId: number, name: string): Promise<Exercise | null> {
    return this.exerciseModel.findOne({
      where: and(
        { userId },
        where(fn('LOWER', col('name')), name.toLowerCase()),
      ),
    });
  }
}
