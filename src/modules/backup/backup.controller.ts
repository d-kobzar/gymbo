import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { ImportBackupDto } from './dto/import.dto';
import { BackupService } from './services/backup.service';

@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('export')
  exportAll(@CurrentUser('id') userId: number) {
    return this.backupService.exportAll(userId);
  }

  @Post('import')
  importFromV1(@CurrentUser('id') userId: number, @Body() dto: ImportBackupDto) {
    return this.backupService.importFromV1(userId, dto);
  }
}
