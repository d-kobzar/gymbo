import { Component } from './component.js';
import { telegram } from '../core/telegram.js';

/**
 * Bottom sheet with backdrop, drag-to-dismiss, and BackButton
 * integration. Mounts into <body>; caller opens via .open() and
 * closes via .close() (or a drag past threshold).
 *
 * props:
 *   title?: string
 *   onClose?: () => void
 */
const DISMISS_THRESHOLD_PX = 100;

export class BottomSheet extends Component {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {HTMLElement | null} */
    this.sheet = null;
    /** @type {HTMLElement | null} */
    this.backdrop = null;
    /** @type {HTMLElement | null} */
    this.body = null;
    this.dragStartY = 0;
    this.dragY = 0;
    this.dragging = false;
    this.isOpen = false;
    this.previousBack = null;
  }

  render() {
    const title = /** @type {string | undefined} */ (this.props.title);

    this.backdrop = Component.parse('<div class="bottom-sheet-backdrop"></div>');
    this.sheet = Component.parse(`
      <aside class="bottom-sheet" role="dialog" aria-modal="true">
        <span class="bottom-sheet__grabber" aria-hidden="true"></span>
        <header class="bottom-sheet__header">
          <h2 class="bottom-sheet__title">${title ? escapeHtml(title) : ''}</h2>
        </header>
        <div class="bottom-sheet__body"></div>
      </aside>
    `);

    this.body = /** @type {HTMLElement} */ (
      this.sheet.querySelector('.bottom-sheet__body')
    );

    document.body.append(this.backdrop, this.sheet);

    this.on(this.backdrop, 'click', () => this.close());

    const grabber = /** @type {HTMLElement} */ (
      this.sheet.querySelector('.bottom-sheet__grabber')
    );
    this.on(grabber, 'pointerdown', this.handleDragStart);
  }

  setBody(node) {
    if (!this.body) return;
    this.body.replaceChildren(node);
  }

  open() {
    if (!this.sheet || !this.backdrop) this.render();
    if (!this.sheet || !this.backdrop) return;
    requestAnimationFrame(() => {
      this.sheet?.classList.add('bottom-sheet--open');
      this.backdrop?.classList.add('bottom-sheet-backdrop--open');
    });
    this.isOpen = true;
    telegram.backButton.show(() => this.close());
  }

  close() {
    this.sheet?.classList.remove('bottom-sheet--open');
    this.backdrop?.classList.remove('bottom-sheet-backdrop--open');
    this.isOpen = false;
    telegram.backButton.hide();
    const onClose = /** @type {(() => void) | undefined} */ (this.props.onClose);
    onClose?.();
  }

  destroy() {
    super.destroy();
    this.sheet?.remove();
    this.backdrop?.remove();
    this.sheet = null;
    this.backdrop = null;
    this.body = null;
  }

  handleDragStart = (event) => {
    const ev = /** @type {PointerEvent} */ (event);
    this.dragging = true;
    this.dragStartY = ev.clientY;
    this.sheet?.classList.add('bottom-sheet--dragging');
    this.on(globalThis, 'pointermove', this.handleDragMove);
    this.on(globalThis, 'pointerup', this.handleDragEnd);
  };

  handleDragMove = (event) => {
    if (!this.dragging || !this.sheet) return;
    const ev = /** @type {PointerEvent} */ (event);
    this.dragY = Math.max(0, ev.clientY - this.dragStartY);
    this.sheet.style.transform = `translateY(${this.dragY}px)`;
  };

  handleDragEnd = () => {
    if (!this.dragging || !this.sheet) return;
    this.dragging = false;
    this.sheet.classList.remove('bottom-sheet--dragging');
    this.sheet.style.transform = '';
    if (this.dragY > DISMISS_THRESHOLD_PX) this.close();
    this.dragY = 0;
  };
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
