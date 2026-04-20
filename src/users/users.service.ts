import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  async findByTelegramId(telegramId: number): Promise<User | null> {
    return this.userModel.findOne({ where: { telegramId } });
  }

  async findById(id: number): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  async create(data: {
    telegramId: number;
    name: string;
    language?: string;
    chatId?: number;
  }): Promise<User> {
    return this.userModel.create(data as any);
  }

  async update(id: number, data: Partial<User>): Promise<User | null> {
    await this.userModel.update(data, { where: { id } });
    return this.findById(id);
  }
}
