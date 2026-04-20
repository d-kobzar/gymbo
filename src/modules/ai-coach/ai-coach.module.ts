import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { Program } from '@modules/programs/models/program.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import { AiThread } from './models/ai-thread.model';
import { AssistantService } from './services/assistant.service';
import { CoachService } from './services/coach.service';
import { ThreadManagerService } from './services/thread-manager.service';
import { ToolExecutorService } from './services/tool-executor.service';
import { GetCurrentProgramHandler } from './tools/handlers/get-current-program.handler';
import { GetExerciseProgressHandler } from './tools/handlers/get-exercise-progress.handler';
import { GetMeasurementsHandler } from './tools/handlers/get-measurements.handler';
import { GetPersonalRecordsHandler } from './tools/handlers/get-personal-records.handler';
import { GetUserStatsHandler } from './tools/handlers/get-user-stats.handler';
import { GetVolumeAnalysisHandler } from './tools/handlers/get-volume-analysis.handler';
import { GetWorkoutsHandler } from './tools/handlers/get-workouts.handler';
import type { CoachTool } from './tools/coach-tool.interface';
import { ToolRegistry } from './tools/tool-registry';

const handlerProviders = [
  GetUserStatsHandler,
  GetWorkoutsHandler,
  GetPersonalRecordsHandler,
  GetMeasurementsHandler,
  GetCurrentProgramHandler,
  GetExerciseProgressHandler,
  GetVolumeAnalysisHandler,
];

@Module({
  imports: [
    SequelizeModule.forFeature([AiThread, TrainingLog, Exercise, BodyMeasurement, Program]),
  ],
  providers: [
    ...handlerProviders,
    {
      provide: ToolRegistry,
      // CoachTool is parameterized; each handler picks its own TParams,
      // but the registry treats them uniformly once registered. The cast
      // is the one variance workaround we accept here.
      useFactory: (...tools: unknown[]) => new ToolRegistry(tools as CoachTool[]),
      inject: handlerProviders,
    },
    ToolExecutorService,
    ThreadManagerService,
    AssistantService,
    CoachService,
  ],
  exports: [CoachService],
})
export class AiCoachModule {}
