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
 * Structured activity session — a workout / run / ride / cardio
 * block with its own duration, energy, HR envelope. Separate from
 * HealthSample (which stores flat time-value-unit readings).
 *
 * Unique on (userId, kind, startDate) so re-ingesting the same
 * daily Shortcut export is idempotent.
 */
@Table({ tableName: 'ActivitySamples', timestamps: true })
export class ActivitySample extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({
    type: DataType.STRING(32),
    allowNull: false,
    defaultValue: 'apple_health',
  })
  source!: string;

  /** Free-form label: running, cycling, functional_strength, hiit,
   * swimming, walking, yoga, other. Case-insensitive by convention. */
  @Column({ type: DataType.STRING(64), allowNull: false })
  kind!: string;

  @Column({ type: DataType.DATE, allowNull: false })
  startDate!: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  endDate!: Date | null;

  /** Duration in seconds. */
  @Column({ type: DataType.INTEGER, allowNull: true })
  duration!: number | null;

  /** Active energy burned, kilocalories. */
  @Column({ type: DataType.DECIMAL(8, 2), allowNull: true })
  energy!: number | null;

  /** Covered distance, meters. Null for non-distance activities. */
  @Column({ type: DataType.DECIMAL(10, 2), allowNull: true })
  distance!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  avgHr!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  maxHr!: number | null;
}
