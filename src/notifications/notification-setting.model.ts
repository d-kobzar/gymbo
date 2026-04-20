import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from '@modules/users/models/user.model';

@Table({ tableName: 'NotificationSettings', timestamps: true })
export class NotificationSetting extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  trainingReminder: boolean;

  @Column({ type: DataType.STRING(5), defaultValue: '18:00' })
  trainingTime: string;

  @Column({ type: DataType.ARRAY(DataType.INTEGER), defaultValue: [1, 3, 5] })
  trainingDays: number[];

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  measurementReminder: boolean;

  @Column({ type: DataType.INTEGER, defaultValue: 1 })
  measurementDay: number;

  @Column({ type: DataType.STRING(5), defaultValue: '09:00' })
  measurementTime: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  weeklySummary: boolean;
}
