import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '@modules/users/models/user.model';

export type SyncProvider = 'apple_health' | 'strava' | 'garmin';

@Table({ tableName: 'SyncConnections', timestamps: true })
export class SyncConnection extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({ type: DataType.STRING(32), allowNull: false })
  provider!: SyncProvider;

  @Column({ type: DataType.STRING(128), allowNull: true })
  token!: string | null;

  @Column({ type: DataType.DATE, allowNull: false })
  connectedAt!: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  lastSyncAt!: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  revokedAt!: Date | null;
}
