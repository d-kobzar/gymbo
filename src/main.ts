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
  // Bind to 0.0.0.0 so Heroku's router can reach the dyno; localhost
  // binding would make the app invisible to the platform.
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`GymBo running on port ${port}`, 'Bootstrap');
}

bootstrap();
