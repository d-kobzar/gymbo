import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '@modules/users/models/user.model';

export type SyncLogStatus = 'ok' | 'unauthorized' | 'invalid' | 'error';

/**
 * Audit row for an ingest attempt. `userId` is nullable — auth
 * failures may not have an identifiable user yet.
 */
@Table({ tableName: 'SyncLogs', timestamps: true })
export class SyncLog extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: true })
  userId!: number | null;

  @BelongsTo(() => User)
  user!: User | null;

  @Column({ type: DataType.STRING(32), allowNull: false })
  provider!: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  status!: SyncLogStatus;

  @Column({ type: DataType.INTEGER, allowNull: true })
  payloadBytes!: number | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  counts!: Record<string, number>;

  @Column({ type: DataType.INTEGER, allowNull: true })
  durationMs!: number | null;

  @Column({ type: DataType.STRING(512), allowNull: true })
  error!: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  ip!: string | null;
}
