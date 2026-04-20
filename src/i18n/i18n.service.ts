import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const SUPPORTED_LANGS = ['en', 'ua', 'ru'];
const DEFAULT_LANG = 'en';

@Injectable()
export class I18nService implements OnModuleInit {
  private locales: Record<string, Record<string, any>> = {};

  onModuleInit() {
    const localesDir = path.join(__dirname, 'locales');
    for (const lang of SUPPORTED_LANGS) {
      const filePath = path.join(localesDir, `${lang}.json`);
      if (fs.existsSync(filePath)) {
        this.locales[lang] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    }
  }

  t(key: string, lang: string, params?: Record<string, any>): string {
    const resolvedLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
    const keys = key.split('.');

    let value: any = this.locales[resolvedLang];
    for (const k of keys) {
      if (value == null || typeof value !== 'object') return key;
      value = value[k];
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
    if (SUPPORTED_LANGS.includes(code)) return code;
    return DEFAULT_LANG;
  }
}
