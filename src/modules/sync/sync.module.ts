import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SyncTokenGuard } from './guards/sync-token.guard';
import { ActivitySample } from './models/activity-sample.model';
import { HealthSample } from './models/health-sample.model';
import { SyncConnection } from './models/sync-connection.model';
import { SyncLog } from './models/sync-log.model';
import { AppleHealthService } from './services/apple-health.service';
import { ShortcutBuilderService } from './services/shortcut-builder.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([
      SyncConnection,
      HealthSample,
      ActivitySample,
      SyncLog,
    ]),
  ],
  controllers: [SyncController],
  providers: [AppleHealthService, ShortcutBuilderService, SyncTokenGuard],
  exports: [SequelizeModule],
})
export class SyncModule {}
