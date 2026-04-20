import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { MeasurementsService } from './measurements.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

@Controller('measurements')
@UseGuards(JwtAuthGuard)
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Get()
  findAll(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.measurementsService.findAll(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  create(@Req() req, @Body() body) {
    return this.measurementsService.create(req.user.id, body);
  }

  @Put(':id')
  update(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() body,
  ) {
    return this.measurementsService.update(req.user.id, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.measurementsService.remove(req.user.id, id);
  }

  @Get('progress')
  getProgress(@Req() req, @Query('metric') metric: string) {
    return this.measurementsService.getProgress(req.user.id, metric);
  }

  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('photo'))
  addPhoto(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('label') label?: string,
  ) {
    return this.measurementsService.addPhoto(req.user.id, id, file, label);
  }

  @Get('export')
  async exportCsv(@Req() req, @Res() res: Response) {
    const csv = await this.measurementsService.exportCsv(req.user.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=measurements.csv',
    );
    res.send(csv);
  }
}
