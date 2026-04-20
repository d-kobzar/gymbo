import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CreateProgramDto } from './dto/create-program.dto';
import { ProgramsService } from './services/programs.service';

@Controller('programs')
@UseGuards(JwtAuthGuard)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  list(@CurrentUser('id') userId: number) {
    return this.programsService.getVersions(userId);
  }

  @Get('versions')
  getVersions(@CurrentUser('id') userId: number) {
    return this.programsService.getVersions(userId);
  }

  @Get('current')
  getCurrent(@CurrentUser('id') userId: number) {
    return this.programsService.getCurrent(userId);
  }

  @Get(':id')
  getById(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.programsService.getById(userId, id);
  }

  @Post()
  create(@CurrentUser('id') userId: number, @Body() dto: CreateProgramDto) {
    return this.programsService.create(userId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.programsService.remove(userId, id);
  }
}
