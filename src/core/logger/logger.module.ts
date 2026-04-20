import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const level =
          config.get<string>('LOG_LEVEL') ?? (isProd ? 'info' : 'debug');

        return {
          pinoHttp: {
            level,
            genReqId: (req: IncomingMessage) => {
              const existing =
                (req.headers['x-request-id'] as string | undefined) ??
                (req.headers['x-correlation-id'] as string | undefined);
              return existing ?? randomUUID();
            },
            customProps: (req: IncomingMessage) => ({
              requestId: (req as IncomingMessage & { id?: string }).id,
            }),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-telegram-bot-api-secret-token"]',
                '*.password',
                '*.token',
                '*.secret',
              ],
              censor: '[redacted]',
            },
            serializers: {
              req: (req: Record<string, unknown>) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: Record<string, unknown>) => ({
                statusCode: res.statusCode,
              }),
            },
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname,req,res,responseTime,requestId',
                  },
                },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
