import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { SyncConnection, type SyncProvider } from '../models/sync-connection.model';

export const SYNC_USER_KEY = 'syncUser';

/**
 * API-key guard for sync ingest endpoints. The athlete's iOS
 * Shortcut (or future Strava / Garmin webhook) carries the token in
 * the `X-API-Key` header — simpler to paste than `Authorization:
 * Bearer <token>` (no prefix, no space, no easy way to typo). We
 * still accept the Authorization form as a fallback for callers
 * that default to it.
 */
@Injectable()
export class SyncTokenGuard implements CanActivate {
  constructor(
    @InjectModel(SyncConnection)
    private readonly connectionModel: typeof SyncConnection,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<
        Request & { [SYNC_USER_KEY]?: { userId: number; provider: SyncProvider } }
      >();

    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing sync token');

    const connection = await this.connectionModel.findOne({
      where: { token, revokedAt: null },
    });
    if (!connection) throw new UnauthorizedException('Invalid sync token');

    req[SYNC_USER_KEY] = {
      userId: connection.userId,
      provider: connection.provider,
    };
    return true;
  }

  private extractToken(req: Request): string | null {
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey === 'string' && apiKey.trim()) return apiKey.trim();
    if (Array.isArray(apiKey) && apiKey[0]?.trim()) return apiKey[0].trim();

    // Legacy fallback — accept Authorization: Bearer <token> too so
    // any ingest-side tooling that defaulted to Bearer still works.
    const auth = req.headers.authorization;
    if (auth?.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim() || null;
    }
    return null;
  }
}
