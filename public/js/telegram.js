/* Telegram WebApp integration */
const TG = {
  webapp: null,
  isTelegram: false,

  init() {
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        this.webapp = window.Telegram.WebApp;
        this.isTelegram = !!this.webapp.initData;
        if (this.isTelegram) {
          this.webapp.ready();
          this.webapp.expand();
          this.webapp.enableClosingConfirmation();
          this.applyTheme();
        }
      }
    } catch (e) {
      console.warn('Telegram WebApp not available:', e);
    }
  },

  applyTheme() {
    if (!this.webapp) return;
    const tp = this.webapp.themeParams;
    if (tp) {
      // Detect light theme by bg color brightness
      const bgColor = tp.bg_color || '#0a0a0a';
      const r = parseInt(bgColor.slice(1, 3), 16);
      const g = parseInt(bgColor.slice(3, 5), 16);
      const b = parseInt(bgColor.slice(5, 7), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      if (brightness > 128) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  },

  haptic(type) {
    try {
      if (!this.webapp || !this.webapp.HapticFeedback) return;
      switch (type) {
        case 'light':
          this.webapp.HapticFeedback.impactOccurred('light');
          break;
        case 'medium':
          this.webapp.HapticFeedback.impactOccurred('medium');
          break;
        case 'heavy':
          this.webapp.HapticFeedback.impactOccurred('heavy');
          break;
        case 'success':
          this.webapp.HapticFeedback.notificationOccurred('success');
          break;
        case 'error':
          this.webapp.HapticFeedback.notificationOccurred('error');
          break;
        case 'warning':
          this.webapp.HapticFeedback.notificationOccurred('warning');
          break;
        default:
          this.webapp.HapticFeedback.impactOccurred('light');
      }
    } catch (e) { /* silent */ }
  },

  getInitData() {
    return this.webapp ? this.webapp.initData : '';
  },

  getUser() {
    if (this.webapp && this.webapp.initDataUnsafe && this.webapp.initDataUnsafe.user) {
      return this.webapp.initDataUnsafe.user;
    }
    return null;
  },

  getLang() {
    const user = this.getUser();
    if (user && user.language_code) {
      const code = user.language_code;
      if (code === 'uk') return 'ua';
      if (['en', 'ru', 'ua'].includes(code)) return code;
    }
    return localStorage.getItem('gymbo_lang') || 'en';
  },

  setupBackButton(callback) {
    if (!this.webapp || !this.webapp.BackButton) return;
    if (callback) {
      this.webapp.BackButton.show();
      this.webapp.BackButton.onClick(callback);
    } else {
      this.webapp.BackButton.hide();
    }
  }
};
