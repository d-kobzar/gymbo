import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { databaseConfig } from './database.config';
import { jwtConfig } from './jwt.config';
import { llmConfig } from './llm.config';
import { openaiConfig } from './openai.config';
import { storageConfig } from './storage.config';
import { telegramConfig } from './telegram.config';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [
        databaseConfig,
        telegramConfig,
        openaiConfig,
        llmConfig,
        storageConfig,
        jwtConfig,
      ],
      cache: true,
    }),
  ],
})
export class ConfigModule {}
