import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { BodyMeasurement } from './body-measurement.model';
import { User } from '@modules/users/models/user.model';

@Table({ tableName: 'MeasurementPhotos', timestamps: true, updatedAt: false })
export class MeasurementPhoto extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id: number;

  @ForeignKey(() => BodyMeasurement)
  @Column({ type: DataType.INTEGER, allowNull: false, onDelete: 'CASCADE' })
  measurementId: number;

  @BelongsTo(() => BodyMeasurement)
  measurement: BodyMeasurement;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.STRING(500), allowNull: false })
  s3Key: string;

  @Column({ type: DataType.STRING(50), allowNull: true })
  label: string;
}
