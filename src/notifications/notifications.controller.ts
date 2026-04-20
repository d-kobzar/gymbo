import {
  Controller,
  Get,
  Put,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  get(@Req() req) {
    return this.notificationsService.get(req.user.id);
  }

  @Put()
  update(@Req() req, @Body() body) {
    return this.notificationsService.update(req.user.id, body);
  }
}
