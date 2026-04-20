import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { StorageService } from '@modules/storage/services/storage.service';
import { CreateMeasurementDto } from '../dto/create-measurement.dto';
import { ListMeasurementsDto } from '../dto/list-measurements.dto';
import {
  MEASUREMENT_METRICS,
  MeasurementMetric,
} from '../dto/progress-query.dto';
import { UpdateMeasurementDto } from '../dto/update-measurement.dto';
import {
  MeasurementCreatedPayload,
  MeasurementEvents,
} from '../events/measurement.events';
import { BodyMeasurement } from '../models/body-measurement.model';
import { MeasurementPhoto } from '../models/measurement-photo.model';

@Injectable()
export class MeasurementsService {
  constructor(
    @InjectModel(BodyMeasurement)
    private readonly measurementModel: typeof BodyMeasurement,
    @InjectModel(MeasurementPhoto)
    private readonly photoModel: typeof MeasurementPhoto,
    private readonly storageService: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: number, data: CreateMeasurementDto): Promise<BodyMeasurement> {
    const measurement = await this.measurementModel.create({
      userId,
      ...data,
    } as Partial<BodyMeasurement>);

    this.events.emit(MeasurementEvents.Created, {
      userId,
      measurementId: measurement.id,
      date: data.date,
    } satisfies MeasurementCreatedPayload);

    return measurement;
  }

  async findAll(userId: number, query: ListMeasurementsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { rows, count } = await this.measurementModel.findAndCountAll({
      where: { userId },
      include: [{ model: MeasurementPhoto }],
      offset: (page - 1) * limit,
      limit,
      // Sort by logical date first, then createdAt as tiebreaker for
      // multiple entries on the same day. Using createdAt alone would
      // surface a backdated entry inserted later as "latest", which
      // is wrong for the hero card and timeline.
      order: [
        ['date', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    // The bucket is private — the raw s3Key is useless to the browser.
    // Presign each photo so the frontend can render it directly via
    // <img src>. Signed URLs live for ~1 h, which matches the page's
    // expected session length.
    const data = await Promise.all(
      rows.map(async (m) => {
        const json = m.toJSON() as Record<string, unknown> & {
          photos?: Array<Record<string, unknown> & { s3Key: string }>;
        };
        if (json.photos?.length) {
          json.photos = await Promise.all(
            json.photos.map(async (p) => ({
              ...p,
              signedUrl: await this.storageService.getSignedUrl(p.s3Key),
            })),
          );
        }
        return json;
      }),
    );

    return {
      data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getProgress(userId: number, metric: MeasurementMetric) {
    if (!MEASUREMENT_METRICS.includes(metric)) {
      throw new BadRequestException(
        `Invalid metric. Allowed: ${MEASUREMENT_METRICS.join(', ')}`,
      );
    }

    const measurements = await this.measurementModel.findAll({
      where: { userId },
      attributes: ['date', metric],
      order: [['date', 'ASC']],
      raw: true,
    });

    return measurements.filter((m) => m[metric as keyof typeof m] !== null);
  }

  async update(
    userId: number,
    id: number,
    data: UpdateMeasurementDto,
  ): Promise<BodyMeasurement> {
    const measurement = await this.measurementModel.findOne({ where: { id, userId } });
    if (!measurement) throw new NotFoundException('Measurement not found');
    await measurement.update(data);
    this.events.emit(MeasurementEvents.Updated, { userId, measurementId: id });
    return measurement;
  }

  async remove(userId: number, id: number): Promise<void> {
    const measurement = await this.measurementModel.findOne({
      where: { id, userId },
      include: [{ model: MeasurementPhoto }],
    });
    if (!measurement) throw new NotFoundException('Measurement not found');

    if (measurement.photos?.length) {
      await Promise.all(
        measurement.photos.map((p) => this.storageService.delete(p.s3Key)),
      );
    }

    await measurement.destroy();
    this.events.emit(MeasurementEvents.Deleted, { userId, measurementId: id });
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
    if (!measurement) throw new NotFoundException('Measurement not found');

    // Layout: photos/{userId}/{yyyy-mm-dd}/{ts}-{name}. Top-level
    // `photos/` namespaces off future non-photo data, and using the
    // measurement's own date keeps every shot from one entry in the
    // same folder even if the upload happens a day later.
    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
    const s3Key = `photos/${userId}/${measurement.date}/${Date.now()}-${safeName}`;
    await this.storageService.upload(file.buffer, s3Key, file.mimetype);

    return this.photoModel.create({
      measurementId,
      userId,
      s3Key,
      label,
    } as Partial<MeasurementPhoto>);
  }

  async exportCsv(userId: number): Promise<string> {
    const measurements = await this.measurementModel.findAll({
      where: { userId },
      order: [['date', 'ASC']],
    });

    const header = 'date,weight,shoulders,arm,chest,waist,abs,glutes,thigh,calf';
    const rows = measurements.map(
      (m) =>
        `${m.date},${m.weight ?? ''},${m.shoulders ?? ''},${m.arm ?? ''},${m.chest ?? ''},${m.waist ?? ''},${m.abs ?? ''},${m.glutes ?? ''},${m.thigh ?? ''},${m.calf ?? ''}`,
    );
    return [header, ...rows].join('\n');
  }
}
