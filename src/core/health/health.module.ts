import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { OpenAIHealthIndicator } from './openai-health.indicator';
import { StorageHealthIndicator } from './storage-health.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [OpenAIHealthIndicator, StorageHealthIndicator],
})
export class HealthModule {}
