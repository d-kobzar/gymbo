import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const SUPPORTED_LANGS = ['en', 'ua', 'ru'] as const;
const DEFAULT_LANG = 'en';

export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
type LocaleTree = { [key: string]: string | LocaleTree };

@Injectable()
export class I18nService implements OnModuleInit {
  private locales: Record<string, LocaleTree> = {};

  onModuleInit(): void {
    // Single source of truth lives in public/locales/ so the bot
    // and the Mini App agree on every string. dist/src/modules/i18n
    // sits four levels below the repo root at runtime (dist/ ships
    // via `nest build`). We climb out and point at public/locales.
    const localesDir = path.resolve(__dirname, '..', '..', '..', '..', 'public', 'locales');
    for (const lang of SUPPORTED_LANGS) {
      const filePath = path.join(localesDir, `${lang}.json`);
      if (fs.existsSync(filePath)) {
        this.locales[lang] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    }
  }

  t(key: string, lang: string, params?: Record<string, unknown>): string {
    const resolvedLang = (SUPPORTED_LANGS as readonly string[]).includes(lang)
      ? lang
      : DEFAULT_LANG;
    const keys = key.split('.');

    let value: string | LocaleTree | undefined = this.locales[resolvedLang];
    for (const k of keys) {
      if (value == null || typeof value !== 'object') return key;
      value = (value as LocaleTree)[k];
    }

    if (typeof value !== 'string') return key;

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) =>
        params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`,
      );
    }

    return value;
  }

  detectLang(code?: string): string {
    if (!code) return DEFAULT_LANG;
    if (code === 'uk') return 'ua';
    if ((SUPPORTED_LANGS as readonly string[]).includes(code)) return code;
    return DEFAULT_LANG;
  }
}
