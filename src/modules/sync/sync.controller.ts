import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { InjectModel } from '@nestjs/sequelize';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { Raw } from '@shared/decorators/raw-response.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { AppleHealthIngestDto } from './dto/apple-health-ingest.dto';
import { SyncTokenGuard, SYNC_USER_KEY } from './guards/sync-token.guard';
import { SyncConnection, type SyncProvider } from './models/sync-connection.model';
import { AppleHealthService } from './services/apple-health.service';
import { ShortcutBuilderService } from './services/shortcut-builder.service';

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
    private readonly shortcutBuilder: ShortcutBuilderService,
    @InjectModel(SyncConnection)
    private readonly connectionModel: typeof SyncConnection,
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

  /**
   * Bridge page that kicks iOS into Shortcuts.app.
   *
   * Telegram Mini App WebView blocks custom URL schemes like
   * shortcuts://, so a direct `<a href="shortcuts://…">` won't fire
   * from inside the app. We hand the browser an HTTPS URL (this
   * endpoint), Telegram's openLink() opens it in Safari, and Safari
   * runs the JS redirect to the shortcuts:// scheme — which iOS
   * happily routes to the Shortcuts import flow.
   */
  @Get('apple-health/install')
  @Raw()
  async appleHealthInstallBridge(
    @Query('t') tokenQuery: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const token = (tokenQuery ?? '').trim();
    if (!token) throw new UnauthorizedException('Missing token');
    const connection = await this.connectionModel.findOne({
      where: { token, revokedAt: null, provider: 'apple_health' },
    });
    if (!connection) throw new NotFoundException('Not available');

    const appUrl =
      this.config.get<string>('APP_URL') ?? `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${appUrl.replace(/\/+$/, '')}/api/sync/apple-health/shortcut?t=${encodeURIComponent(token)}`;
    const shortcutsUri = `shortcuts://import-shortcut/?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent('GymBo Sync')}`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Install GymBo Sync</title>
  <style>
    html,body{margin:0;padding:0;background:#0B0B0E;color:#F5F6F7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;}
    main{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:20px;text-align:center;}
    h1{font-size:22px;font-weight:800;margin:0;}
    p{margin:0;color:#9BA1A6;font-size:15px;line-height:1.45;max-width:360px;}
    a.btn{display:inline-block;padding:14px 28px;background:#FFB020;color:#111;text-decoration:none;border-radius:14px;font-weight:800;font-size:15px;}
    a.btn:active{opacity:0.8;}
  </style>
</head>
<body>
<main>
  <h1>Opening Shortcuts…</h1>
  <p>If nothing happens automatically, tap the button below to install the GymBo Sync shortcut.</p>
  <a class="btn" id="go" href="${shortcutsUri}">Open in Shortcuts</a>
</main>
<script>
  location.replace(${JSON.stringify(shortcutsUri)});
</script>
</body>
</html>`;

    res
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'no-store')
      .send(html);
  }

  /**
   * Serve the iOS Shortcut file with the user's token pre-baked in.
   *
   * Called by iOS itself via the `shortcuts://import-shortcut/?url=…`
   * scheme — which means no JWT header is available, so auth rides
   * on the ?t= query parameter (the long-lived Apple Health bearer
   * we already minted). If the token leaks, only that user's data
   * is exposed; the token is also embedded in the file the user
   * will install, so in-URL is no worse than in-file.
   */
  @Get('apple-health/shortcut')
  @Raw()
  async appleHealthShortcut(
    @Query('t') tokenQuery: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const token = (tokenQuery ?? '').trim();
    if (!token) throw new UnauthorizedException('Missing token');
    const connection = await this.connectionModel.findOne({
      where: { token, revokedAt: null, provider: 'apple_health' },
    });
    if (!connection) throw new NotFoundException('Shortcut not available');

    const appUrl =
      this.config.get<string>('APP_URL') ?? `${req.protocol}://${req.get('host')}`;
    const ingestUrl = `${appUrl.replace(/\/+$/, '')}/api/sync/apple-health/ingest`;

    const body = this.shortcutBuilder.build({ token, ingestUrl });

    res
      .status(200)
      .setHeader('Content-Type', 'application/x-apple-shortcut; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        'attachment; filename="gymbo-sync.shortcut"',
      )
      .setHeader('Cache-Control', 'no-store')
      .send(body);
  }
}
