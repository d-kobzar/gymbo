import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { StorageModule } from '@modules/storage/storage.module';
import { MeasurementsController } from './measurements.controller';
import { BodyMeasurement } from './models/body-measurement.model';
import { MeasurementPhoto } from './models/measurement-photo.model';
import { MeasurementsService } from './services/measurements.service';

@Module({
  imports: [SequelizeModule.forFeature([BodyMeasurement, MeasurementPhoto]), StorageModule],
  controllers: [MeasurementsController],
  providers: [MeasurementsService],
  exports: [MeasurementsService, SequelizeModule],
})
export class MeasurementsModule {}
