import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '@modules/users/models/user.model';

/**
 * Generic time-series bucket for HealthKit / wearable metrics that
 * don't map onto BodyMeasurement / TrainingLog. Sleep duration,
 * resting HR, HRV, active-energy, steps all land here with unit
 * preserved. Uniqueness on (userId, metric, startDate) makes
 * re-ingesting the same daily export idempotent.
 */
@Table({ tableName: 'HealthSamples', timestamps: true })
export class HealthSample extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: 'apple_health' })
  source!: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  metric!: string;

  @Column({ type: DataType.DATE, allowNull: false })
  startDate!: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  endDate!: Date | null;

  @Column({ type: DataType.DECIMAL(10, 3), allowNull: false })
  value!: number;

  @Column({ type: DataType.STRING(16), allowNull: true })
  unit!: string | null;
}
