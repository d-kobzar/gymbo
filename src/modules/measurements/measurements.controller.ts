import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { Raw } from '@shared/decorators/raw-response.decorator';
import { AddPhotoDto } from './dto/add-photo.dto';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { ListMeasurementsDto } from './dto/list-measurements.dto';
import { ProgressQueryDto } from './dto/progress-query.dto';
import { UpdateMeasurementDto } from './dto/update-measurement.dto';
import { MeasurementsService } from './services/measurements.service';

@Controller('measurements')
@UseGuards(JwtAuthGuard)
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: number, @Query() query: ListMeasurementsDto) {
    return this.measurementsService.findAll(userId, query);
  }

  @Post()
  create(@CurrentUser('id') userId: number, @Body() dto: CreateMeasurementDto) {
    return this.measurementsService.create(userId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMeasurementDto,
  ) {
    return this.measurementsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.measurementsService.remove(userId, id);
  }

  @Get('progress')
  getProgress(@CurrentUser('id') userId: number, @Query() query: ProgressQueryDto) {
    return this.measurementsService.getProgress(userId, query.metric);
  }

  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('photo'))
  addPhoto(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AddPhotoDto,
  ) {
    return this.measurementsService.addPhoto(userId, id, file, dto.label);
  }

  @Get('export')
  @Raw()
  async exportCsv(@CurrentUser('id') userId: number, @Res() res: Response) {
    const csv = await this.measurementsService.exportCsv(userId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=measurements.csv');
    res.send(csv);
  }
}
