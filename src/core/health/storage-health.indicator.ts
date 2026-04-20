import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { StorageConfig } from '../config/storage.config';

@Injectable()
export class StorageHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async isHealthy(key = 'b2'): Promise<HealthIndicatorResult> {
    const cfg = this.config.getOrThrow<StorageConfig>('storage');
    if (!cfg.bucket || !cfg.endpoint) {
      throw new HealthCheckError(
        'B2 not configured',
        this.getStatus(key, false, { reason: 'missing_config' }),
      );
    }

    const client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region || 'us-east-005',
      credentials: { accessKeyId: cfg.keyId, secretAccessKey: cfg.appKey },
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'B2 bucket unreachable',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
