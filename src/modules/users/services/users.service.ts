import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../models/user.model';

export interface CreateUserInput {
  telegramId: number;
  name: string;
  language?: string;
  chatId?: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  findByTelegramId(telegramId: number): Promise<User | null> {
    return this.userModel.findOne({ where: { telegramId } });
  }

  findById(id: number): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  create(data: CreateUserInput): Promise<User> {
    return this.userModel.create(data as Partial<User>);
  }

  async update(id: number, data: Partial<User>): Promise<User | null> {
    await this.userModel.update(data, { where: { id } });
    return this.findById(id);
  }
}
