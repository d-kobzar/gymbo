import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from '@modules/users/models/user.model';
import { Exercise } from '../exercises/exercise.model';

@Table({ tableName: 'TrainingLogs', timestamps: true, updatedAt: false })
export class TrainingLog extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Exercise)
  @Column({ type: DataType.INTEGER, allowNull: false })
  exerciseId: number;

  @BelongsTo(() => Exercise)
  exercise: Exercise;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  date: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  setNumber: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  reps: number;

  @Column({ type: DataType.DECIMAL(6, 2), allowNull: false })
  weight: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  rir: number;
}
