import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route Nest's built-in Logger calls through pino.
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api', { exclude: ['/', '/bot/webhook', '/health'] });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors();

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`GymBo running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
