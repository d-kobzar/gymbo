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
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { Raw } from '@shared/decorators/raw-response.decorator';
import { CreateTrainingLogDto } from './dto/create-training-log.dto';
import { ListTrainingLogsDto } from './dto/list-training-logs.dto';
import { UpdateTrainingLogDto } from './dto/update-training-log.dto';
import { TrainingLogsService } from './services/training-logs.service';

@Controller('training-logs')
@UseGuards(JwtAuthGuard)
export class TrainingLogsController {
  constructor(private readonly trainingLogsService: TrainingLogsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: number, @Query() query: ListTrainingLogsDto) {
    return this.trainingLogsService.findAll(userId, query);
  }

  @Post()
  create(@CurrentUser('id') userId: number, @Body() dto: CreateTrainingLogDto) {
    return this.trainingLogsService.create(userId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrainingLogDto,
  ) {
    return this.trainingLogsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.trainingLogsService.remove(userId, id);
  }

  @Get('progress')
  getProgress(
    @CurrentUser('id') userId: number,
    @Query('exerciseId', ParseIntPipe) exerciseId: number,
  ) {
    return this.trainingLogsService.getProgress(userId, exerciseId);
  }

  @Get('export')
  @Raw()
  async exportCsv(@CurrentUser('id') userId: number, @Res() res: Response) {
    const csv = await this.trainingLogsService.exportCsv(userId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=training-logs.csv');
    res.send(csv);
  }
}
