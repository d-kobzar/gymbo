import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Exercise } from '@modules/exercises/models/exercise.model';
import { BotModule } from '@modules/bot/bot.module';
import { I18nModule } from '@modules/i18n/i18n.module';
import { LlmModule } from '@modules/llm/llm.module';
import { BodyMeasurement } from '@modules/measurements/models/body-measurement.model';
import { Program } from '@modules/programs/models/program.model';
import { TrainingLog } from '@modules/training-logs/models/training-log.model';
import { User } from '@modules/users/models/user.model';
import { CoachContext } from './models/coach-context.model';
import { CoachMessage } from './models/coach-message.model';
import { CoachAgentService } from './services/coach-agent.service';
import { CoachContextService } from './services/coach-context.service';
import { CoachService } from './services/coach.service';
import { MessageQueueService } from './services/message-queue.service';
import { RollingSummaryService } from './services/rolling-summary.service';
import { ToolExecutorService } from './services/tool-executor.service';
import { GetCurrentProgramHandler } from './tools/handlers/get-current-program.handler';
import { GetExerciseProgressHandler } from './tools/handlers/get-exercise-progress.handler';
import { GetMeasurementsHandler } from './tools/handlers/get-measurements.handler';
import { GetPersonalRecordsHandler } from './tools/handlers/get-personal-records.handler';
import { GetUserStatsHandler } from './tools/handlers/get-user-stats.handler';
import { GetVolumeAnalysisHandler } from './tools/handlers/get-volume-analysis.handler';
import { GetWorkoutsHandler } from './tools/handlers/get-workouts.handler';
import { RecordCoachingDecisionHandler } from './tools/handlers/record-coaching-decision.handler';
import { UpdateUserProfileHandler } from './tools/handlers/update-user-profile.handler';
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
  UpdateUserProfileHandler,
  RecordCoachingDecisionHandler,
];

@Module({
  imports: [
    SequelizeModule.forFeature([
      CoachContext,
      CoachMessage,
      TrainingLog,
      Exercise,
      BodyMeasurement,
      Program,
      User,
    ]),
    LlmModule,
    I18nModule,
    forwardRef(() => BotModule),
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
    CoachContextService,
    RollingSummaryService,
    CoachAgentService,
    MessageQueueService,
    CoachService,
  ],
  exports: [CoachService],
})
export class AiCoachModule {}
