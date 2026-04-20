import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Exercise } from './exercise.model';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectModel(Exercise) private readonly exerciseModel: typeof Exercise,
  ) {}

  async create(userId: number, name: string): Promise<Exercise> {
    const existing = await this.exerciseModel.findOne({
      where: { userId, name },
    });
    if (existing) {
      throw new ConflictException('Exercise with this name already exists');
    }
    return this.exerciseModel.create({ userId, name });
  }

  async findAll(userId: number): Promise<Exercise[]> {
    return this.exerciseModel.findAll({
      where: { userId },
      order: [['name', 'ASC']],
    });
  }

  async update(userId: number, id: number, name: string): Promise<Exercise> {
    const exercise = await this.exerciseModel.findOne({
      where: { id, userId },
    });
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    const duplicate = await this.exerciseModel.findOne({
      where: { userId, name },
    });
    if (duplicate && duplicate.id !== id) {
      throw new ConflictException('Exercise with this name already exists');
    }

    exercise.name = name;
    await exercise.save();
    return exercise;
  }

  async remove(userId: number, id: number): Promise<void> {
    const exercise = await this.exerciseModel.findOne({
      where: { id, userId },
    });
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }
    await exercise.destroy();
  }
}
