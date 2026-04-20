import { haptics } from '../core/haptics.js';

/**
 * Global toast singleton. Mounted lazily into document.body on first
 * show. No multiple stacking for now — new toasts replace the current.
 */

/** @typedef {'info' | 'success' | 'error' | 'warning'} ToastVariant */

class ToastManager {
  constructor() {
    /** @type {HTMLElement | null} */
    this.root = null;
    /** @type {HTMLElement | null} */
    this.messageEl = null;
    /** @type {HTMLButtonElement | null} */
    this.actionEl = null;
    /** @type {number | null} */
    this.timer = null;
    this.currentVariant = 'info';
  }

  mount() {
    if (this.root) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.innerHTML = `
      <span class="toast__message"></span>
      <button class="toast__action" hidden type="button"></button>
    `;
    document.body.appendChild(node);
    this.root = node;
    this.messageEl = /** @type {HTMLElement} */ (node.querySelector('.toast__message'));
    this.actionEl = /** @type {HTMLButtonElement} */ (node.querySelector('.toast__action'));
  }

  /**
   * @param {string} message
   * @param {{ variant?: ToastVariant, duration?: number, action?: { label: string, onClick: () => void } }=} opts
   */
  show(message, opts = {}) {
    this.mount();
    if (!this.root || !this.messageEl || !this.actionEl) return;

    const variant = /** @type {ToastVariant} */ (opts.variant ?? 'info');
    const duration = opts.duration ?? 2500;

    // Reset classes + apply new variant.
    this.root.className = `toast toast--${variant} toast--open`;
    this.messageEl.textContent = message;

    if (opts.action) {
      this.actionEl.hidden = false;
      this.actionEl.textContent = opts.action.label;
      this.actionEl.onclick = () => {
        opts.action?.onClick();
        this.hide();
      };
    } else {
      this.actionEl.hidden = true;
      this.actionEl.onclick = null;
    }

    if (variant === 'success') haptics.success();
    else if (variant === 'error') haptics.error();
    else if (variant === 'warning') haptics.warning();

    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = /** @type {number} */ (
      /** @type {unknown} */ (setTimeout(() => this.hide(), duration))
    );
    this.currentVariant = variant;
  }

  hide() {
    if (!this.root) return;
    this.root.classList.remove('toast--open');
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const toast = new ToastManager();
