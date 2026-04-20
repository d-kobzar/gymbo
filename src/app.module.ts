import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { databaseConfig } from './config/database.config';

// Core modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { I18nModule } from './i18n/i18n.module';
import { StorageModule } from './storage/storage.module';

// Feature modules
import { ExercisesModule } from './exercises/exercises.module';
import { TrainingLogsModule } from './training-logs/training-logs.module';
import { MeasurementsModule } from './measurements/measurements.module';
import { ProgramsModule } from './programs/programs.module';
import { StatsModule } from './stats/stats.module';
import { BackupModule } from './backup/backup.module';
import { NotificationsModule } from './notifications/notifications.module';

// Bot & AI
import { BotModule } from './bot/bot.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    // Database
    SequelizeModule.forRoot(databaseConfig),

    // Static files (Mini App frontend)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),

    // Core
    I18nModule,
    StorageModule,
    AuthModule,
    UsersModule,

    // Features
    ExercisesModule,
    TrainingLogsModule,
    MeasurementsModule,
    ProgramsModule,
    StatsModule,
    BackupModule,
    NotificationsModule,

    // Bot & AI
    BotModule,
    AiModule,
  ],
})
export class AppModule {}
