import { Column, DataType, HasMany, HasOne, Model, Table } from 'sequelize-typescript';
import { Exercise } from '@/exercises/exercise.model';
import { TrainingLog } from '@/training-logs/training-log.model';
import { BodyMeasurement } from '@/measurements/body-measurement.model';
import { MeasurementPhoto } from '@/measurements/measurement-photo.model';
import { Program } from '@/programs/program.model';
import { NotificationSetting } from '@/notifications/notification-setting.model';
import { AiThread } from '@/ai/ai-thread.model';

@Table({ tableName: 'Users', timestamps: true })
export class User extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @Column({ type: DataType.BIGINT, unique: true, allowNull: false })
  telegramId!: number;

  @Column({ type: DataType.BIGINT, allowNull: true })
  chatId!: number;

  @Column({ type: DataType.STRING })
  name!: string;

  @Column({ type: DataType.STRING(2), defaultValue: 'en' })
  language!: string;

  @Column({ type: DataType.STRING(50), defaultValue: 'UTC' })
  timezone!: string;

  @HasMany(() => Exercise)
  exercises!: Exercise[];

  @HasMany(() => TrainingLog)
  trainingLogs!: TrainingLog[];

  @HasMany(() => BodyMeasurement)
  bodyMeasurements!: BodyMeasurement[];

  @HasMany(() => MeasurementPhoto)
  measurementPhotos!: MeasurementPhoto[];

  @HasMany(() => Program)
  programs!: Program[];

  @HasOne(() => NotificationSetting)
  notificationSetting!: NotificationSetting;

  @HasOne(() => AiThread)
  aiThread!: AiThread;
}
