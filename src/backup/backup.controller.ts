import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('export')
  exportAll(@Req() req) {
    return this.backupService.exportAll(req.user.id);
  }

  @Post('import')
  importFromV1(@Req() req, @Body() body) {
    return this.backupService.importFromV1(req.user.id, body);
  }
}
