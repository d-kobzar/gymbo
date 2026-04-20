import type { Context, MiddlewareFn } from 'telegraf';
import type { I18nService } from '@modules/i18n/services/i18n.service';

/**
 * Attaches `ctx.i18n.t(key, params)` bound to the caller's language.
 * Handlers don't need to pass the language themselves — they just
 * call `ctx.i18n.t('bot.welcome')`.
 *
 * Language resolution prefers the Telegram user's declared
 * language_code, with a safety fallback to 'en' via I18nService.
 */
declare module 'telegraf' {
  interface Context {
    i18n?: { t: (key: string, params?: Record<string, unknown>) => string };
  }
}

export function createI18nMiddleware(i18n: I18nService): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const lang = i18n.detectLang(ctx.from?.language_code);
    ctx.i18n = {
      t: (key, params) => i18n.t(key, lang, params),
    };
    await next();
  };
}
