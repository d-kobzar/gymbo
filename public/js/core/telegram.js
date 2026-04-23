/**
 * Thin wrapper over the Telegram WebApp SDK.
 *
 * - Tolerates a missing `window.Telegram.WebApp` (dev in a plain browser).
 * - Exposes BackButton and MainButton via property getters so callers
 *   can register handlers without reaching into the SDK.
 * - Haptics methods fall back to no-op when unsupported.
 *
 * Usage:
 *   import { telegram } from '@/core/telegram.js';
 *   telegram.ready();
 *   telegram.backButton.show(() => router.back());
 */

/**
 * @typedef {'light' | 'medium' | 'heavy' | 'rigid' | 'soft'} HapticImpactStyle
 * @typedef {'error' | 'success' | 'warning'} HapticNotificationType
 */

const NO_OP = () => {};

class BackButtonWrapper {
  /** @param {any} sdk */
  constructor(sdk) {
    this.sdk = sdk;
    this.handler = null;
  }

  show(onClick) {
    if (!this.sdk) return;
    this.handler = onClick;
    this.sdk.onClick(onClick);
    this.sdk.show();
  }

  hide() {
    if (!this.sdk) return;
    if (this.handler) {
      this.sdk.offClick(this.handler);
      this.handler = null;
    }
    this.sdk.hide();
  }
}

class MainButtonWrapper {
  /** @param {any} sdk */
  constructor(sdk) {
    this.sdk = sdk;
    this.handler = null;
  }

  show(params = {}, onClick) {
    if (!this.sdk) return false;
    if (params.text) this.sdk.setText(params.text);
    if (typeof params.disabled === 'boolean') {
      if (params.disabled) this.sdk.disable();
      else this.sdk.enable();
    }
    if (onClick) {
      if (this.handler) this.sdk.offClick(this.handler);
      this.handler = onClick;
      this.sdk.onClick(onClick);
    }
    this.sdk.show();
    return true;
  }

  hide() {
    if (!this.sdk) return;
    if (this.handler) {
      this.sdk.offClick(this.handler);
      this.handler = null;
    }
    this.sdk.hide();
  }

  setText(text) {
    this.sdk?.setText(text);
  }

  setProgress(on) {
    if (!this.sdk) return;
    on ? this.sdk.showProgress() : this.sdk.hideProgress();
  }
}

class Telegram {
  constructor() {
    /** @type {any} */
    this.webApp = globalThis.Telegram?.WebApp ?? null;
    this.backButton = new BackButtonWrapper(this.webApp?.BackButton ?? null);
    this.mainButton = new MainButtonWrapper(this.webApp?.MainButton ?? null);
  }

  get isAvailable() {
    return this.webApp !== null;
  }

  get initData() {
    return this.webApp?.initData ?? '';
  }

  get user() {
    return this.webApp?.initDataUnsafe?.user ?? null;
  }

  get themeParams() {
    return this.webApp?.themeParams ?? {};
  }

  get colorScheme() {
    return this.webApp?.colorScheme ?? 'dark';
  }

  ready() {
    this.webApp?.ready();
  }

  expand() {
    this.webApp?.expand();
  }

  close() {
    this.webApp?.close();
  }

  /** Open an https URL in the external browser (Safari on iOS).
   * Telegram's WebView sandboxes the Mini App — direct `location`
   * changes to non-HTTP schemes silently fail, and even HTTP links
   * lose the Back button context. `openLink` pops to Safari and
   * resolves those issues. Falls back to window.open for dev. */
  openLink(url) {
    if (!url) return;
    if (this.webApp?.openLink) {
      this.webApp.openLink(url);
      return;
    }
    globalThis.open?.(url, '_blank', 'noopener,noreferrer');
  }

  /** @param {HapticImpactStyle} style */
  hapticImpact(style = 'light') {
    this.webApp?.HapticFeedback?.impactOccurred(style);
  }

  /** @param {HapticNotificationType} type */
  hapticNotification(type) {
    this.webApp?.HapticFeedback?.notificationOccurred(type);
  }

  hapticSelection() {
    this.webApp?.HapticFeedback?.selectionChanged();
  }

  /**
   * Returns a promise that resolves with the popup button_id or null.
   * @param {{ title?: string, message: string, buttons?: Array<{ id: string, type?: string, text: string }> }} params
   */
  showPopup(params) {
    if (!this.webApp?.showPopup) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        this.webApp.showPopup(params, (id) => resolve(id ?? null));
      } catch {
        resolve(null);
      }
    });
  }

  /** @param {string} message */
  showConfirm(message) {
    if (!this.webApp?.showConfirm) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        this.webApp.showConfirm(message, (ok) => resolve(Boolean(ok)));
      } catch {
        resolve(false);
      }
    });
  }
}

export const telegram = new Telegram();

// Mirror-friendly export for tests that need a fresh instance against
// a stubbed `globalThis.Telegram`.
export { Telegram };

// Keep a global for legacy (old js/telegram.js) consumers during Phase 5.
// Phase 6 removes this line when the shim goes away.
globalThis.TGCore = telegram;
