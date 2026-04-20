import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '@modules/users/models/user.model';

export type CoachGoal = 'hypertrophy' | 'strength' | 'cut' | 'maintenance';
export type CoachExperience = 'beginner' | 'intermediate' | 'advanced';
export type CoachEquipment =
  | 'barbell'
  | 'dumbbell'
  | 'machines'
  | 'bodyweight'
  | 'cables';

export interface CoachProfile {
  goal?: CoachGoal;
  experienceLevel?: CoachExperience;
  trainingDaysPerWeek?: number;
  equipment?: CoachEquipment[];
  injuries?: string[];
  preferences?: Record<string, unknown>;
}

export interface CoachDecision {
  at: string;
  topic: string;
  decision: string;
}

@Table({ tableName: 'CoachContexts', timestamps: true })
export class CoachContext extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  profile!: CoachProfile;

  @Column({ type: DataType.TEXT, allowNull: true })
  rollingSummary!: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  recentDecisions!: CoachDecision[];

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  messagesSinceSummary!: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  summaryStale!: boolean;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  version!: number;
}
