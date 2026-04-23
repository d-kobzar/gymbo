import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

const BODY_LOG_CAP = 16 * 1024;

function truncateBodyForLog(body: unknown): unknown {
  if (body == null) return undefined;
  try {
    const s = typeof body === 'string' ? body : JSON.stringify(body);
    if (s.length <= BODY_LOG_CAP) return body;
    return {
      _truncated: true,
      length: s.length,
      preview: s.slice(0, BODY_LOG_CAP),
    };
  } catch {
    return '[unserializable]';
  }
}

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
                'req.headers["x-api-key"]',
                'req.body.token',
                'req.body.password',
                'req.body.secret',
                '*.password',
                '*.token',
                '*.secret',
              ],
              censor: '[redacted]',
            },
            serializers: {
              req: (req: Record<string, unknown>) => {
                const raw = (req as { raw?: { body?: unknown } }).raw;
                return {
                  id: req.id,
                  method: req.method,
                  url: req.url,
                  body: truncateBodyForLog(raw?.body),
                };
              },
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
                    ignore: 'pid,hostname,res,responseTime,requestId',
                  },
                },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
