import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  validateSync,
} from 'class-validator';

export class EnvSchema {
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['postgres', 'postgresql'],
  })
  DATABASE_URL!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number;

  @IsString()
  TELEGRAM_BOT_TOKEN!: string;

  @IsString()
  TELEGRAM_WEBHOOK_SECRET!: string;

  @IsUrl({ require_tld: false })
  APP_URL!: string;

  @IsString()
  OPENAI_API_KEY!: string;

  @IsUrl({ require_tld: false })
  B2_ENDPOINT!: string;

  @IsString()
  B2_REGION!: string;

  @IsString()
  B2_KEY_ID!: string;

  @IsString()
  B2_APP_KEY!: string;

  @IsString()
  B2_BUCKET!: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvSchema {
  const parsed = plainToInstance(EnvSchema, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, {
    skipMissingProperties: false,
    whitelist: false,
  });
  if (errors.length) {
    const lines = errors.map((e) => {
      const constraints = Object.values(e.constraints ?? {}).join(', ');
      return `  - ${e.property}: ${constraints || 'invalid'}`;
    });
    throw new Error(
      `Invalid environment configuration:\n${lines.join('\n')}`,
    );
  }
  return parsed;
}
