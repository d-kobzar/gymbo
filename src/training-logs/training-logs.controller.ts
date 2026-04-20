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
  ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { TrainingLogsService } from './training-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('training-logs')
@UseGuards(JwtAuthGuard)
export class TrainingLogsController {
  constructor(private readonly trainingLogsService: TrainingLogsService) {}

  @Get()
  findAll(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('date') date?: string,
    @Query('exerciseId') exerciseId?: string,
  ) {
    return this.trainingLogsService.findAll(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      date,
      exerciseId: exerciseId ? parseInt(exerciseId, 10) : undefined,
    });
  }

  @Post()
  create(@Req() req, @Body() body) {
    return this.trainingLogsService.create(req.user.id, body);
  }

  @Put(':id')
  update(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() body,
  ) {
    return this.trainingLogsService.update(req.user.id, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.trainingLogsService.remove(req.user.id, id);
  }

  @Get('progress')
  getProgress(
    @Req() req,
    @Query('exerciseId', ParseIntPipe) exerciseId: number,
  ) {
    return this.trainingLogsService.getProgress(req.user.id, exerciseId);
  }

  @Get('export')
  async exportCsv(@Req() req, @Res() res: Response) {
    const csv = await this.trainingLogsService.exportCsv(req.user.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=training-logs.csv',
    );
    res.send(csv);
  }
}
