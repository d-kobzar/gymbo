import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const { status, envelope } = this.toEnvelope(exception, request.id);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} ${envelope.error.code}: ${envelope.error.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.debug(
        `${request.method} ${request.url} → ${status} ${envelope.error.code}`,
      );
    }

    response.status(status).json(envelope);
  }

  private toEnvelope(
    exception: unknown,
    requestId?: string,
  ): { status: number; envelope: ErrorEnvelope } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const code = this.codeFromStatus(status);

      if (typeof raw === 'string') {
        return {
          status,
          envelope: {
            error: { code, message: raw },
            requestId,
          },
        };
      }

      if (raw && typeof raw === 'object') {
        const body = raw as {
          message?: string | string[];
          error?: unknown;
          details?: unknown;
          [key: string]: unknown;
        };
        const message = Array.isArray(body.message)
          ? body.message.join('; ')
          : body.message ??
            (typeof body.error === 'string' ? body.error : undefined) ??
            exception.message;
        const errorCode =
          typeof body.error === 'string'
            ? body.error.toUpperCase().replace(/\s+/g, '_')
            : code;
        const details =
          body.details ??
          (typeof body.error === 'object' ? body.error : undefined);
        return {
          status,
          envelope: {
            error: { code: errorCode, message, details },
            requestId,
          },
        };
      }
    }

    const err = exception as Error;
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      envelope: {
        error: {
          code: 'INTERNAL_ERROR',
          message: err?.message ?? 'Internal server error',
        },
        requestId,
      },
    };
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
    };
    return map[status] ?? `HTTP_${status}`;
  }
}
