import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  findAll(@Req() req) {
    return this.exercisesService.findAll(req.user.id);
  }

  @Post()
  create(@Req() req, @Body('name') name: string) {
    return this.exercisesService.create(req.user.id, name);
  }

  @Put(':id')
  update(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body('name') name: string,
  ) {
    return this.exercisesService.update(req.user.id, id, name);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.exercisesService.remove(req.user.id, id);
  }
}
