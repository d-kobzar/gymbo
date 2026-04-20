import { Column, DataType, HasMany, HasOne, Model, Table } from 'sequelize-typescript';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { MeasurementPhoto } from '@modules/measurements/models/measurement-photo.model';
import { Program } from '@modules/programs/models/program.model';
import { NotificationSetting } from '@modules/notifications/models/notification-setting.model';
import { AiThread } from '@modules/ai-coach/models/ai-thread.model';

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

  @Column({ type: DataType.DATE, allowNull: true })
  onboardedAt!: Date | null;

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
