import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CoachContext } from '@modules/ai-coach/models/coach-context.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { User } from './models/user.model';
import { OnboardingService } from './services/onboarding.service';
import { UsersService } from './services/users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [SequelizeModule.forFeature([User, CoachContext, BodyMeasurement])],
  controllers: [UsersController],
  providers: [UsersService, OnboardingService],
  exports: [UsersService, SequelizeModule],
})
export class UsersModule {}
