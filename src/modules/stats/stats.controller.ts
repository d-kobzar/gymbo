import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { VolumeQueryDto } from './dto/volume-query.dto';
import { StatsService } from './services/stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser('id') userId: number) {
    return this.statsService.getDashboard(userId);
  }

  @Get('prs')
  getPersonalRecords(@CurrentUser('id') userId: number) {
    return this.statsService.getPersonalRecords(userId);
  }

  @Get('calendar')
  getCalendar(@CurrentUser('id') userId: number, @Query() query: CalendarQueryDto) {
    return this.statsService.getCalendar(userId, query.year, query.month);
  }

  @Get('volume')
  getVolume(@CurrentUser('id') userId: number, @Query() query: VolumeQueryDto) {
    return this.statsService.getVolume(userId, query.weeks ?? 4);
  }
}
