import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '@modules/users/models/user.model';
import { TrainingLog } from '@/training-logs/training-log.model';
import { ProgramExercise } from '@/programs/program-exercise.model';

@Table({
  tableName: 'Exercises',
  timestamps: true,
  updatedAt: false,
  indexes: [{ unique: true, fields: ['userId', 'name'] }],
})
export class Exercise extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({ type: DataType.STRING, allowNull: false })
  name!: string;

  @HasMany(() => TrainingLog)
  trainingLogs!: TrainingLog[];

  @HasMany(() => ProgramExercise)
  programExercises!: ProgramExercise[];
}
