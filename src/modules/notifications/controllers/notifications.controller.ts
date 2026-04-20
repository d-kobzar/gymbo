import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UpdateNotificationSettingDto } from '../dto/update-notification-setting.dto';
import { NotificationsService } from '../services/notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  get(@CurrentUser('id') userId: number) {
    return this.notificationsService.get(userId);
  }

  @Put()
  update(@CurrentUser('id') userId: number, @Body() dto: UpdateNotificationSettingDto) {
    return this.notificationsService.update(userId, dto);
  }
}
