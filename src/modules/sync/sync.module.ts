import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { SyncTokenGuard } from './guards/sync-token.guard';
import { HealthSample } from './models/health-sample.model';
import { SyncConnection } from './models/sync-connection.model';
import { AppleHealthService } from './services/apple-health.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([SyncConnection, HealthSample, BodyMeasurement]),
  ],
  controllers: [SyncController],
  providers: [AppleHealthService, SyncTokenGuard],
  exports: [SequelizeModule],
})
export class SyncModule {}
