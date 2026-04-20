import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

@Controller('programs')
@UseGuards(JwtAuthGuard)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  list(@Req() req) {
    return this.programsService.getVersions(req.user.id);
  }

  @Get('versions')
  getVersions(@Req() req) {
    return this.programsService.getVersions(req.user.id);
  }

  @Get('current')
  getCurrent(@Req() req) {
    return this.programsService.getCurrent(req.user.id);
  }

  @Get(':id')
  getById(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.programsService.getById(req.user.id, id);
  }

  @Post()
  create(@Req() req, @Body() body) {
    return this.programsService.create(req.user.id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.programsService.remove(req.user.id, id);
  }
}
