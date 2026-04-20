/* i18n translation loader */
const I18n = {
  lang: 'en',
  translations: {},
  loaded: {},

  async init() {
    this.lang = TG.getLang();
    await this.load(this.lang);
  },

  async load(lang) {
    if (this.loaded[lang]) {
      this.translations = this.loaded[lang];
      this.lang = lang;
      return;
    }
    try {
      const res = await fetch(`/locales/${lang}.json`);
      if (res.ok) {
        this.loaded[lang] = await res.json();
        this.translations = this.loaded[lang];
        this.lang = lang;
      } else {
        // Fallback to English
        if (lang !== 'en') {
          await this.load('en');
        }
      }
    } catch (e) {
      console.warn('i18n load failed:', e);
      if (lang !== 'en') {
        await this.load('en');
      }
    }
  },

  t(key, params) {
    const keys = key.split('.');
    let val = this.translations;
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        return key; // fallback to key
      }
    }
    if (typeof val !== 'string') return key;
    if (params) {
      return val.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
    }
    return val;
  },

  apply(root) {
    const container = root || document;
    const els = container.querySelectorAll('[data-i18n]');
    els.forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = this.t(key);
      if (translated !== key) {
        el.textContent = translated;
      }
    });

    // Also handle placeholders
    const placeholderEls = container.querySelectorAll('[data-i18n-placeholder]');
    placeholderEls.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translated = this.t(key);
      if (translated !== key) {
        el.placeholder = translated;
      }
    });
  },

  async setLang(lang) {
    await this.load(lang);
    localStorage.setItem('gymbo_lang', lang);
    this.apply();
    // Re-apply tab bar labels
    this.apply(document.getElementById('tab-bar'));
  }
};
