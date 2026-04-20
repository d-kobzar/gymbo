import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '@modules/users/models/user.model';

@Table({ tableName: 'AiThreads', timestamps: true, updatedAt: false })
export class AiThread extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({ type: DataType.STRING(100), allowNull: false })
  threadId!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  assistantId!: string;
}
