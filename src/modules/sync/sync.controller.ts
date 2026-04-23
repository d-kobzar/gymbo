import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { AppleHealthIngestDto } from './dto/apple-health-ingest.dto';
import { SyncTokenGuard, SYNC_USER_KEY } from './guards/sync-token.guard';
import type { SyncProvider } from './models/sync-connection.model';
import { AppleHealthService } from './services/apple-health.service';

/**
 * /sync endpoints.
 *
 * User-facing (JWT-auth):
 *   GET  /sync/status              — all providers + their state
 *   POST /sync/apple-health/connect — issue / rotate long-lived token
 *   DEL  /sync/apple-health         — revoke
 *
 * Ingest endpoints (SyncTokenGuard — separate auth):
 *   POST /sync/apple-health/ingest  — iOS Shortcut payload
 */
@Controller('sync')
export class SyncController {
  constructor(
    private readonly appleHealth: AppleHealthService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUser('id') userId: number) {
    const appleHealth = await this.appleHealth.status(userId);
    const shortcutUrl =
      this.config.get<string>('APPLE_HEALTHKIT_SHORTCUT_URL') ?? null;
    return {
      providers: {
        apple_health: { ...appleHealth, shortcutUrl },
        strava: { connected: false, comingSoon: true },
        garmin: { connected: false, comingSoon: true },
      },
    };
  }

  @Post('apple-health/connect')
  @UseGuards(JwtAuthGuard)
  async connectAppleHealth(@CurrentUser('id') userId: number) {
    const { token, connectedAt } = await this.appleHealth.connect(userId);
    const shortcutUrl =
      this.config.get<string>('APPLE_HEALTHKIT_SHORTCUT_URL') ?? null;
    return { token, connectedAt, shortcutUrl };
  }

  @Delete('apple-health')
  @UseGuards(JwtAuthGuard)
  async disconnectAppleHealth(@CurrentUser('id') userId: number) {
    await this.appleHealth.disconnect(userId);
    return { ok: true };
  }

  @Post('apple-health/ingest')
  @UseGuards(SyncTokenGuard)
  async ingestAppleHealth(
    @Req() req: Request & { [SYNC_USER_KEY]?: { userId: number; provider: SyncProvider } },
    @Body() dto: AppleHealthIngestDto,
  ) {
    const ctx = req[SYNC_USER_KEY];
    if (!ctx) return { ok: false };
    const counts = await this.appleHealth.ingest(ctx.userId, dto);
    return { ok: true, counts };
  }
}
