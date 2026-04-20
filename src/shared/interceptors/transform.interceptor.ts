import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

export interface ResponseEnvelope<T> {
  data: T;
  meta: {
    requestId?: string;
    timestamp: string;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, T | ResponseEnvelope<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | ResponseEnvelope<T>> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRaw || context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request & { id?: string }>();

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          requestId: req.id,
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
