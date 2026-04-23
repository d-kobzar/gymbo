import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATE_CANDIDATES = [
  // dev path: relative to source tree
  path.resolve(__dirname, '..', 'shortcut', 'gymbo-sync.plist.xml'),
  // prod path after `nest build` — plist stays in src/, we copy at
  // startup fallback or the file sits one more level down.
  path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'src',
    'modules',
    'sync',
    'shortcut',
    'gymbo-sync.plist.xml',
  ),
];

/**
 * Builds a per-user iOS Shortcut file by patching the token and
 * ingest URL into the XML plist template. iOS Shortcuts.app
 * accepts XML plists directly via the shortcuts://import-shortcut
 * URL scheme — no binary plist conversion needed, no iCloud signing
 * required.
 *
 * The template is a fully valid .shortcut export from Shortcuts.app
 * with two string placeholders we substitute at request time:
 *   __TOKEN__       → SyncConnections.token for this user
 *   __INGEST_URL__  → absolute POST target
 */
@Injectable()
export class ShortcutBuilderService {
  private readonly logger = new Logger(ShortcutBuilderService.name);
  private cachedTemplate: string | null = null;

  build(params: { token: string; ingestUrl: string }): string {
    const template = this.loadTemplate();
    return template
      .replaceAll('__TOKEN__', escapeXml(params.token))
      .replaceAll('__INGEST_URL__', escapeXml(params.ingestUrl));
  }

  private loadTemplate(): string {
    if (this.cachedTemplate) return this.cachedTemplate;
    for (const p of TEMPLATE_CANDIDATES) {
      if (fs.existsSync(p)) {
        this.cachedTemplate = fs.readFileSync(p, 'utf-8');
        return this.cachedTemplate;
      }
    }
    this.logger.error(
      `Shortcut template not found in any candidate path: ${TEMPLATE_CANDIDATES.join(', ')}`,
    );
    throw new Error('Shortcut template missing');
  }
}

/**
 * XML plist string escaper — the token is hex and the URL contains
 * only URL-safe chars, so in practice no entity substitution fires,
 * but we keep the safety net in case either ever grows to contain
 * <, >, &, or quotes (e.g., if someone routes through a query-string
 * on a dev proxy).
 */
function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
