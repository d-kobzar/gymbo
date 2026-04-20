import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// Core infrastructure
import { ConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { LoggerModule } from './core/logger/logger.module';
import { EventBusModule } from './core/events/event-bus.module';
import { HealthModule } from './core/health/health.module';

// Global cross-cutting
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';

// Feature modules
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { I18nModule } from '@modules/i18n/i18n.module';
import { StorageModule } from '@modules/storage/storage.module';
import { ExercisesModule } from './exercises/exercises.module';
import { TrainingLogsModule } from './training-logs/training-logs.module';
import { MeasurementsModule } from './measurements/measurements.module';
import { ProgramsModule } from './programs/programs.module';
import { StatsModule } from './stats/stats.module';
import { BackupModule } from './backup/backup.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BotModule } from './bot/bot.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    // Core
    ConfigModule,
    LoggerModule,
    EventBusModule,
    DatabaseModule,
    HealthModule,

    // Static files (Mini App frontend)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),

    // Domain
    I18nModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    TrainingLogsModule,
    MeasurementsModule,
    ProgramsModule,
    StatsModule,
    BackupModule,
    NotificationsModule,
    BotModule,
    AiModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
