import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '@modules/users/models/user.model';

export type CoachMessageRole = 'user' | 'assistant';
export type CoachMessageSummaryStatus = 'none' | 'processed';

/**
 * One persisted turn of the coach conversation. Written BEFORE the
 * LLM is called so a crash mid-processing doesn't lose user input.
 *
 * Lifecycle flags (both nullable timestamps):
 *   - processedAt: the row has been included in an LLM batch.
 *   - summarizedAt: the row has been folded into the rolling summary
 *     on CoachContexts and is eligible for GC after 7 days.
 */
@Table({ tableName: 'CoachMessages', timestamps: true })
export class CoachMessage extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({ type: DataType.STRING(16), allowNull: false })
  role!: CoachMessageRole;

  @Column({ type: DataType.TEXT, allowNull: false })
  content!: string;

  @Column({ type: DataType.DATE, allowNull: true })
  processedAt!: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  summarizedAt!: Date | null;

  /** Coarser flag mirrored by `summarizedAt` — makes the Active
   * Buffer query (`WHERE summaryStatus = 'none'`) both readable
   * and index-friendly. */
  @Column({
    type: DataType.ENUM('none', 'processed'),
    allowNull: false,
    defaultValue: 'none',
  })
  summaryStatus!: CoachMessageSummaryStatus;
}
