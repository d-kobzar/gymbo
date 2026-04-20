import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { User } from '../users/user.model';
import { ProgramDay } from './program-day.model';

@Table({
  tableName: 'Programs',
  timestamps: true,
  updatedAt: false,
  indexes: [{ unique: true, fields: ['userId', 'version'] }],
})
export class Program extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.INTEGER, allowNull: false })
  version: number;

  @Column({ type: DataType.STRING, allowNull: true })
  name: string;

  @HasMany(() => ProgramDay)
  days: ProgramDay[];
}
