/**
 * Lightweight i18n:
 * - loads the three locale JSONs in parallel at init,
 * - resolves nested keys via dot-notation,
 * - interpolates {placeholders},
 * - falls back to the key itself when a translation is missing.
 *
 * Language is chosen by the caller (usually from the Telegram user
 * language_code) and can be swapped at runtime.
 */

const SUPPORTED = ['en', 'ua', 'ru'];
const DEFAULT = 'en';

class I18n {
  constructor() {
    /** @type {Record<string, Record<string, unknown>>} */
    this.locales = {};
    this.lang = DEFAULT;
  }

  /** @param {string} lang */
  setLang(lang) {
    this.lang = SUPPORTED.includes(lang) ? lang : DEFAULT;
  }

  /** @param {string=} code */
  detectLang(code) {
    if (!code) return DEFAULT;
    if (code === 'uk') return 'ua';
    return SUPPORTED.includes(code) ? code : DEFAULT;
  }

  async load(basePath = '/locales') {
    const results = await Promise.all(
      SUPPORTED.map(async (lang) => {
        try {
          const res = await fetch(`${basePath}/${lang}.json`);
          if (!res.ok) return [lang, {}];
          return [lang, await res.json()];
        } catch {
          return [lang, {}];
        }
      }),
    );
    for (const [lang, dict] of results) {
      this.locales[/** @type {string} */ (lang)] = /** @type {any} */ (dict);
    }
  }

  /**
   * @param {string} key — dot-separated (e.g. "bot.welcome")
   * @param {Record<string, string | number>=} params
   * @returns {string}
   */
  t(key, params) {
    const dict = this.locales[this.lang] ?? this.locales[DEFAULT] ?? {};
    let value = /** @type {unknown} */ (dict);
    for (const k of key.split('.')) {
      if (value && typeof value === 'object') {
        value = /** @type {Record<string, unknown>} */ (value)[k];
      } else {
        value = undefined;
        break;
      }
    }
    if (typeof value !== 'string') return key;
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (_, name) =>
      params[name] !== undefined ? String(params[name]) : `{${name}}`,
    );
  }
}

export const i18n = new I18n();
