import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BodyMeasurement } from './body-measurement.model';
import { MeasurementPhoto } from './measurement-photo.model';
import { MeasurementsService } from './measurements.service';
import { MeasurementsController } from './measurements.controller';
import { StorageModule } from '@modules/storage/storage.module';

@Module({
  imports: [
    SequelizeModule.forFeature([BodyMeasurement, MeasurementPhoto]),
    StorageModule,
  ],
  controllers: [MeasurementsController],
  providers: [MeasurementsService],
  exports: [MeasurementsService],
})
export class MeasurementsModule {}
