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
import { MeasurementPhoto } from './measurement-photo.model';

@Table({ tableName: 'BodyMeasurements', timestamps: true, updatedAt: false })
export class BodyMeasurement extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  date: string;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true })
  weight: number;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true })
  shoulders: number;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true })
  arm: number;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true })
  chest: number;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true })
  waist: number;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true })
  abs: number;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true })
  glutes: number;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true })
  thigh: number;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true })
  calf: number;

  @HasMany(() => MeasurementPhoto)
  photos: MeasurementPhoto[];
}
