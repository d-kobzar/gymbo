import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  getDashboard(@Req() req) {
    return this.statsService.getDashboard(req.user.id);
  }

  @Get('prs')
  getPersonalRecords(@Req() req) {
    return this.statsService.getPersonalRecords(req.user.id);
  }

  @Get('calendar')
  getCalendar(
    @Req() req,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.statsService.getCalendar(req.user.id, year, month);
  }

  @Get('volume')
  getVolume(@Req() req, @Query('weeks') weeks?: string) {
    return this.statsService.getVolume(
      req.user.id,
      weeks ? parseInt(weeks, 10) : 4,
    );
  }
}
