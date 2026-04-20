import { Component } from './component.js';
import { haptics } from '../core/haptics.js';
import { telegram } from '../core/telegram.js';

const SWIPE_THRESHOLD = 40;
const FADE_MS = 200;

/**
 * Fullscreen photo viewer with swipe / click navigation.
 *
 * props:
 *   photos: Array<{ url: string, label?: string, date?: string }>
 *   initialIndex?: number
 *
 * Lifecycle:
 *   new Lightbox(document.body, props).open()
 *   — auto-destroys after close (fade-out then DOM removal).
 *
 * Controls:
 *   - X / backdrop tap / Telegram BackButton / Escape → close.
 *   - Chevrons / swipe left-right / arrow keys → prev / next.
 */
export class Lightbox extends Component {
  constructor(root, props = {}) {
    super(root, props);
    this.photos = /** @type {Array<{url:string,label?:string,date?:string}>} */ (
      props.photos ?? []
    );
    this.index = Number(props.initialIndex ?? 0);
    if (this.index < 0) this.index = 0;
    if (this.index >= this.photos.length) this.index = this.photos.length - 1;
    /** @type {HTMLElement | null} */
    this.shell = null;
    /** @type {HTMLImageElement | null} */
    this.imgEl = null;
    /** @type {HTMLElement | null} */
    this.captionEl = null;
    /** @type {HTMLButtonElement | null} */
    this.prevBtn = null;
    /** @type {HTMLButtonElement | null} */
    this.nextBtn = null;
    this.touchStartX = 0;
    this.closed = false;
  }

  open() {
    if (!this.photos.length) return;
    this.render();
    requestAnimationFrame(() => this.shell?.classList.add('lightbox--open'));
    telegram.backButton.show(() => this.close());
  }

  render() {
    const shell = document.createElement('div');
    shell.className = 'lightbox';
    shell.innerHTML = `
      <button class="lightbox__close" type="button" aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Prev">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <img class="lightbox__img" alt="">
      <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Next">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <div class="lightbox__caption" data-role="caption"></div>
    `;
    document.body.appendChild(shell);
    this.shell = shell;
    this.imgEl = /** @type {HTMLImageElement} */ (shell.querySelector('.lightbox__img'));
    this.captionEl = /** @type {HTMLElement} */ (shell.querySelector('[data-role="caption"]'));
    this.prevBtn = /** @type {HTMLButtonElement} */ (shell.querySelector('.lightbox__nav--prev'));
    this.nextBtn = /** @type {HTMLButtonElement} */ (shell.querySelector('.lightbox__nav--next'));

    const closeBtn = /** @type {HTMLButtonElement} */ (shell.querySelector('.lightbox__close'));
    this.on(closeBtn, 'click', (e) => {
      e.stopPropagation();
      this.close();
    });
    this.on(this.prevBtn, 'click', (e) => {
      e.stopPropagation();
      this.step(-1);
    });
    this.on(this.nextBtn, 'click', (e) => {
      e.stopPropagation();
      this.step(1);
    });
    // Backdrop tap → close, but only when tapping the shell itself,
    // not the image.
    this.on(shell, 'click', (e) => {
      if (e.target === shell) this.close();
    });
    this.on(shell, 'touchstart', (e) => {
      const t = /** @type {TouchEvent} */ (e);
      this.touchStartX = t.touches[0]?.clientX ?? 0;
    }, { passive: true });
    this.on(shell, 'touchend', (e) => {
      const t = /** @type {TouchEvent} */ (e);
      const endX = t.changedTouches[0]?.clientX ?? this.touchStartX;
      const dx = endX - this.touchStartX;
      if (Math.abs(dx) > SWIPE_THRESHOLD) this.step(dx < 0 ? 1 : -1);
    });
    this.on(document, 'keydown', (event) => {
      if (this.closed) return;
      const ev = /** @type {KeyboardEvent} */ (event);
      if (ev.key === 'Escape') this.close();
      else if (ev.key === 'ArrowLeft') this.step(-1);
      else if (ev.key === 'ArrowRight') this.step(1);
    });

    this.update();
  }

  /** @param {number} delta */
  step(delta) {
    const next = this.index + delta;
    if (next < 0 || next >= this.photos.length) return;
    haptics.select();
    this.index = next;
    this.update();
  }

  update() {
    const p = this.photos[this.index];
    if (!p || !this.imgEl || !this.captionEl) return;
    this.imgEl.src = p.url;
    this.imgEl.alt = p.label ?? '';
    const parts = [];
    if (p.date) parts.push(p.date);
    if (p.label) parts.push(p.label.toUpperCase());
    parts.push(`${this.index + 1} / ${this.photos.length}`);
    this.captionEl.textContent = parts.join(' · ');
    this.prevBtn?.toggleAttribute('disabled', this.index === 0);
    this.nextBtn?.toggleAttribute('disabled', this.index === this.photos.length - 1);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    telegram.backButton.hide();
    this.shell?.classList.remove('lightbox--open');
    setTimeout(() => this.destroy(), FADE_MS);
  }

  destroy() {
    super.destroy();
    this.shell?.remove();
    this.shell = null;
    this.imgEl = null;
    this.captionEl = null;
    this.prevBtn = null;
    this.nextBtn = null;
  }
}
