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
 * Bearer-token guard for sync ingest endpoints. The athlete pastes
 * a long-lived token into their iOS Shortcut / Strava webhook; every
 * request carries it in `Authorization: Bearer <token>`. We look up
 * the matching active SyncConnection and attach `{ userId, provider }`
 * to the request so the controller knows whose data to accept.
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
    const header = req.headers.authorization;
    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing sync token');
    }
    const token = header.slice(7).trim();
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
}
