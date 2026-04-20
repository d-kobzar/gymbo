import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BodyMeasurement } from './body-measurement.model';
import { MeasurementPhoto } from './measurement-photo.model';
import { StorageService } from '@modules/storage/services/storage.service';

const METRIC_WHITELIST = [
  'weight',
  'shoulders',
  'arm',
  'chest',
  'waist',
  'abs',
  'glutes',
  'thigh',
  'calf',
];

@Injectable()
export class MeasurementsService {
  constructor(
    @InjectModel(BodyMeasurement)
    private readonly measurementModel: typeof BodyMeasurement,
    @InjectModel(MeasurementPhoto)
    private readonly photoModel: typeof MeasurementPhoto,
    private readonly storageService: StorageService,
  ) {}

  async create(userId: number, data: Partial<BodyMeasurement>) {
    return this.measurementModel.create({ userId, ...data });
  }

  async findAll(userId: number, query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const { rows, count } = await this.measurementModel.findAndCountAll({
      where: { userId },
      include: [{ model: MeasurementPhoto }],
      offset: (page - 1) * limit,
      limit,
      order: [['createdAt', 'DESC']],
    });

    return {
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getProgress(userId: number, metric: string) {
    if (!METRIC_WHITELIST.includes(metric)) {
      throw new BadRequestException(
        `Invalid metric. Allowed: ${METRIC_WHITELIST.join(', ')}`,
      );
    }

    const measurements = await this.measurementModel.findAll({
      where: { userId },
      attributes: ['date', metric],
      order: [['date', 'ASC']],
      raw: true,
    });

    return measurements.filter((m) => m[metric] !== null);
  }

  async update(userId: number, id: number, data: Partial<BodyMeasurement>) {
    const measurement = await this.measurementModel.findOne({
      where: { id, userId },
    });
    if (!measurement) {
      throw new NotFoundException('Measurement not found');
    }
    await measurement.update(data);
    return measurement;
  }

  async remove(userId: number, id: number): Promise<void> {
    const measurement = await this.measurementModel.findOne({
      where: { id, userId },
      include: [{ model: MeasurementPhoto }],
    });
    if (!measurement) {
      throw new NotFoundException('Measurement not found');
    }

    if (measurement.photos && measurement.photos.length > 0) {
      for (const photo of measurement.photos) {
        await this.storageService.delete(photo.s3Key);
      }
    }

    await measurement.destroy();
  }

  async addPhoto(
    userId: number,
    measurementId: number,
    file: Express.Multer.File,
    label?: string,
  ) {
    const measurement = await this.measurementModel.findOne({
      where: { id: measurementId, userId },
    });
    if (!measurement) {
      throw new NotFoundException('Measurement not found');
    }

    const s3Key = `measurements/${userId}/${measurementId}/${Date.now()}-${file.originalname}`;
    await this.storageService.upload(file.buffer, s3Key, file.mimetype);

    return this.photoModel.create({
      measurementId,
      userId,
      s3Key,
      label,
    });
  }

  async exportCsv(userId: number): Promise<string> {
    const measurements = await this.measurementModel.findAll({
      where: { userId },
      order: [['date', 'ASC']],
    });

    const header =
      'date,weight,shoulders,arm,chest,waist,abs,glutes,thigh,calf';
    const rows = measurements.map(
      (m) =>
        `${m.date},${m.weight ?? ''},${m.shoulders ?? ''},${m.arm ?? ''},${m.chest ?? ''},${m.waist ?? ''},${m.abs ?? ''},${m.glutes ?? ''},${m.thigh ?? ''},${m.calf ?? ''}`,
    );

    return [header, ...rows].join('\n');
  }
}
