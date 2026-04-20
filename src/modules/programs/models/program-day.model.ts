import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { Program } from './program.model';
import { ProgramExercise } from './program-exercise.model';

@Table({ tableName: 'ProgramDays', timestamps: false })
export class ProgramDay extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => Program)
  @Column({ type: DataType.INTEGER, allowNull: false, onDelete: 'CASCADE' })
  programId!: number;

  @BelongsTo(() => Program)
  program!: Program;

  @Column({ type: DataType.STRING(20), allowNull: false })
  day!: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isRest!: boolean;

  @HasMany(() => ProgramExercise)
  exercises!: ProgramExercise[];
}
