import { Component } from './component.js';
import { haptics } from '../core/haptics.js';

/**
 * Set row — one logged set. Click fires onEdit. On touch devices
 * the row supports swipe-left-to-delete (threshold 80px); on desktop
 * a long-press (550ms) invokes onDelete too.
 *
 * props:
 *   setNumber: number
 *   reps: number
 *   weight: number
 *   rir?: number
 *   isDone?: boolean
 *   isPr?: boolean
 *   onEdit?: () => void
 *   onDelete?: () => void
 */

const SWIPE_THRESHOLD_PX = 80;
const LONG_PRESS_MS = 550;

export class SetRow extends Component {
  constructor(root, props = {}) {
    super(root, props);
    this.startX = 0;
    this.deltaX = 0;
    /** @type {number | null} */
    this.longPressTimer = null;
  }

  render() {
    const {
      setNumber = 0,
      reps = 0,
      weight = 0,
      rir,
      isDone = false,
      isPr = false,
    } = this.props;

    const rirSuffix = rir !== undefined && rir !== null ? ` · RIR ${rir}` : '';
    const prBadge = isPr ? '<span class="set-row__pr">PR</span>' : '';
    const checkIcon = isDone
      ? '<svg class="set-row__check" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4 4 8-8"/></svg>'
      : '';

    const node = Component.parse(`
      <div class="set-row${isDone ? '' : ''}" role="button" tabindex="0">
        <span class="set-row__badge${isDone ? ' set-row__badge--done' : ''}">${setNumber}</span>
        <span class="set-row__data">${reps} × ${weight} kg${rirSuffix}</span>
        ${prBadge}
        ${checkIcon}
      </div>
    `);
    this.root.replaceChildren(node);

    this.on(node, 'click', this.handleClick);
    this.on(node, 'pointerdown', this.handlePointerDown);
    this.on(node, 'pointermove', this.handlePointerMove);
    this.on(node, 'pointerup', this.handlePointerUp);
    this.on(node, 'pointercancel', this.handlePointerCancel);
  }

  handleClick = () => {
    haptics.tap();
    /** @type {(() => void) | undefined} */
    (this.props.onEdit)?.();
  };

  handlePointerDown = (event) => {
    const ev = /** @type {PointerEvent} */ (event);
    this.startX = ev.clientX;
    this.deltaX = 0;
    this.longPressTimer = /** @type {number} */ (
      /** @type {unknown} */ (setTimeout(() => this.handleLongPress(), LONG_PRESS_MS))
    );
  };

  handlePointerMove = (event) => {
    const ev = /** @type {PointerEvent} */ (event);
    this.deltaX = ev.clientX - this.startX;
    if (Math.abs(this.deltaX) > 5 && this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.deltaX < 0) {
      const row = /** @type {HTMLElement} */ (this.root.firstElementChild);
      row?.classList.add('set-row--swiping');
      row?.style.setProperty('--swipe-x', `${this.deltaX}px`);
    }
  };

  handlePointerUp = () => {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    const row = /** @type {HTMLElement} */ (this.root.firstElementChild);
    if (this.deltaX < -SWIPE_THRESHOLD_PX) {
      haptics.warning();
      /** @type {(() => void) | undefined} */
      (this.props.onDelete)?.();
    }
    row?.classList.remove('set-row--swiping');
    row?.style.removeProperty('--swipe-x');
    this.deltaX = 0;
  };

  handlePointerCancel = () => {
    this.handlePointerUp();
  };

  handleLongPress() {
    this.longPressTimer = null;
    haptics.bump();
    /** @type {(() => void) | undefined} */
    (this.props.onDelete)?.();
  }
}
