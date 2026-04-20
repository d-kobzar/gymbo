import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: number;
  telegramId: number;
  [key: string]: unknown;
}

/**
 * Extracts the authenticated user from the request, as attached by the
 * JWT strategy. Optionally project a specific field: `@CurrentUser('id')`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
