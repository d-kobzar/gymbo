import { Component } from './component.js';
import { haptics } from '../core/haptics.js';
import { i18n } from '../core/i18n.js';
import { telegram } from '../core/telegram.js';

const RING_RADIUS = 92;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const HAPTIC_TICK_SECS = 10;
const ADD_SECONDS = 15;
const TICK_MS = 250;

/**
 * Fullscreen rest timer overlay per the V2Rest design: radial-amber
 * background, 240 px progress ring, big mono countdown, Skip and
 * Add-15s buttons, and an optional "next set" footer.
 *
 * props:
 *   seconds: number     — total rest duration.
 *   nextSetLabel?: string — footer text (e.g. "NEXT · SET 5 · 8 × 80 KG").
 *   onComplete?: () => void
 *   onSkip?: () => void
 *
 * Lifecycle:
 *   new RestTimer(document.body, props).open()
 *   — automatically mounts, starts the countdown, destroys itself
 *     after complete or skip (a slight fade-out before DOM removal).
 *
 * Haptics:
 *   - haptics.tap on Skip / +15s press.
 *   - haptics.warning at T-10 seconds.
 *   - haptics.success at 0.
 *
 * BackButton:
 *   - While open, Telegram BackButton skips the timer.
 */
export class RestTimer extends Component {
  constructor(root, props = {}) {
    super(root, props);
    this.totalMs = Math.max(0, Number(props.seconds ?? 90) * 1000);
    this.startTs = 0;
    /** @type {number | null} */
    this.tickHandle = null;
    /** @type {HTMLElement | null} */
    this.shell = null;
    /** @type {SVGCircleElement | null} */
    this.fgRing = null;
    /** @type {HTMLElement | null} */
    this.digitEl = null;
    /** @type {HTMLElement | null} */
    this.captionEl = null;
    this.warnedAt10 = false;
    this.closed = false;
  }

  open() {
    this.render();
    this.startTs = performance.now();
    this.tickHandle = /** @type {number} */ (
      /** @type {unknown} */ (setInterval(() => this.tick(), TICK_MS))
    );
    // Paint initial frame before the transition kicks in.
    this.tick();
    requestAnimationFrame(() => this.shell?.classList.add('rest-timer--open'));
    telegram.backButton.show(() => this.skip());
  }

  render() {
    const caption = i18n.t('rest.of', { total: formatMmSs(this.totalMs / 1000) });
    const kicker = i18n.t('rest.title');
    const skipLabel = i18n.t('rest.skip');
    const addLabel = i18n.t('rest.add_seconds', { seconds: ADD_SECONDS });
    const nextSet = /** @type {string | undefined} */ (this.props.nextSetLabel);

    const shell = document.createElement('div');
    shell.className = 'rest-timer';
    shell.innerHTML = `
      <span class="rest-timer__kicker">${escapeHtml(kicker)}</span>
      <div class="rest-timer__ring">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle class="rest-timer__ring-bg" cx="100" cy="100" r="${RING_RADIUS}"></circle>
          <circle class="rest-timer__ring-fg" cx="100" cy="100" r="${RING_RADIUS}"
            stroke-dasharray="${RING_CIRCUMFERENCE}"
            stroke-dashoffset="0"></circle>
        </svg>
        <div class="rest-timer__center">
          <span class="rest-timer__digit" data-role="digit">${formatMmSs(this.totalMs / 1000)}</span>
          <span class="rest-timer__caption" data-role="caption">${escapeHtml(caption)}</span>
        </div>
      </div>
      <div class="rest-timer__actions">
        <button class="rest-timer__action rest-timer__action--skip" type="button" data-role="skip">
          ${escapeHtml(skipLabel)}
        </button>
        <button class="rest-timer__action rest-timer__action--add" type="button" data-role="add">
          ${escapeHtml(addLabel)}
        </button>
      </div>
      ${nextSet ? `<div class="rest-timer__footer">${escapeHtml(nextSet)}</div>` : ''}
    `;
    document.body.appendChild(shell);

    this.shell = shell;
    this.fgRing = /** @type {SVGCircleElement} */ (shell.querySelector('.rest-timer__ring-fg'));
    this.digitEl = /** @type {HTMLElement} */ (shell.querySelector('[data-role="digit"]'));
    this.captionEl = /** @type {HTMLElement} */ (shell.querySelector('[data-role="caption"]'));

    const skipBtn = /** @type {HTMLButtonElement} */ (shell.querySelector('[data-role="skip"]'));
    const addBtn = /** @type {HTMLButtonElement} */ (shell.querySelector('[data-role="add"]'));
    this.on(skipBtn, 'click', () => {
      haptics.tap();
      this.skip();
    });
    this.on(addBtn, 'click', () => {
      haptics.tap();
      this.totalMs += ADD_SECONDS * 1000;
      this.warnedAt10 = false;
      this.updateCaption();
      this.tick();
    });
  }

  tick() {
    if (this.closed) return;
    const elapsed = performance.now() - this.startTs;
    const remaining = Math.max(0, this.totalMs - elapsed);
    const remainingSecs = Math.ceil(remaining / 1000);
    const pct = 1 - remaining / this.totalMs;

    if (this.digitEl) this.digitEl.textContent = formatMmSs(remainingSecs);
    if (this.fgRing) {
      this.fgRing.setAttribute(
        'stroke-dashoffset',
        String(RING_CIRCUMFERENCE * pct),
      );
    }

    if (!this.warnedAt10 && remainingSecs === HAPTIC_TICK_SECS) {
      this.warnedAt10 = true;
      haptics.warning();
    }

    if (remaining <= 0) {
      haptics.success();
      this.complete();
    }
  }

  updateCaption() {
    if (!this.captionEl) return;
    this.captionEl.textContent = i18n.t('rest.of', {
      total: formatMmSs(this.totalMs / 1000),
    });
  }

  complete() {
    if (this.closed) return;
    /** @type {(() => void) | undefined} */
    const cb = this.props.onComplete;
    this.close(cb);
  }

  skip() {
    if (this.closed) return;
    /** @type {(() => void) | undefined} */
    const cb = this.props.onSkip;
    this.close(cb);
  }

  close(callback) {
    this.closed = true;
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    telegram.backButton.hide();
    this.shell?.classList.remove('rest-timer--open');
    setTimeout(() => {
      this.destroy();
      if (callback) callback();
    }, 220);
  }

  destroy() {
    super.destroy();
    this.shell?.remove();
    this.shell = null;
    this.fgRing = null;
    this.digitEl = null;
    this.captionEl = null;
  }
}

function formatMmSs(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
