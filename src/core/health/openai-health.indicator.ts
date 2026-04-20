import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import OpenAI from 'openai';
import type { OpenAIConfig } from '../config/openai.config';

@Injectable()
export class OpenAIHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async isHealthy(key = 'openai'): Promise<HealthIndicatorResult> {
    const { apiKey } = this.config.getOrThrow<OpenAIConfig>('openai');
    if (!apiKey) {
      throw new HealthCheckError(
        'OpenAI API key not configured',
        this.getStatus(key, false, { reason: 'missing_api_key' }),
      );
    }

    try {
      const client = new OpenAI({ apiKey });
      await client.models.retrieve('gpt-4o');
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'OpenAI unreachable',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
