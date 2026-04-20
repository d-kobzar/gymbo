import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  SequelizeHealthIndicator,
} from '@nestjs/terminus';
import { Raw } from '../../shared/decorators/raw-response.decorator';
import { OpenAIHealthIndicator } from './openai-health.indicator';
import { StorageHealthIndicator } from './storage-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: SequelizeHealthIndicator,
    private readonly openai: OpenAIHealthIndicator,
    private readonly storage: StorageHealthIndicator,
  ) {}

  @Get()
  @Raw()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.openai.isHealthy('openai'),
      () => this.storage.isHealthy('b2'),
    ]);
  }
}
