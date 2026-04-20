import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { ExercisesService } from './services/exercises.service';

@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  findAll(@CurrentUser('id') userId: number) {
    return this.exercisesService.findAll(userId);
  }

  @Post()
  create(@CurrentUser('id') userId: number, @Body() dto: CreateExerciseDto) {
    return this.exercisesService.create(userId, dto.name);
  }

  @Put(':id')
  update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.exercisesService.update(userId, id, dto.name);
  }

  @Delete(':id')
  remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.exercisesService.remove(userId, id);
  }
}
