import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { ProgramDay } from './program-day.model';
import { Exercise } from '@modules/exercises/models/exercise.model';

@Table({ tableName: 'ProgramExercises', timestamps: false })
export class ProgramExercise extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id: number;

  @ForeignKey(() => ProgramDay)
  @Column({ type: DataType.INTEGER, allowNull: false, onDelete: 'CASCADE' })
  programDayId: number;

  @BelongsTo(() => ProgramDay)
  programDay: ProgramDay;

  @ForeignKey(() => Exercise)
  @Column({ type: DataType.INTEGER, allowNull: false, onDelete: 'CASCADE' })
  exerciseId: number;

  @BelongsTo(() => Exercise)
  exercise: Exercise;

  @Column({ type: DataType.INTEGER, defaultValue: 3 })
  sets: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  sortOrder: number;
}
