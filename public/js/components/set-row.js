import { Component } from './component.js';
import { haptics } from '../core/haptics.js';

/**
 * Set row — one logged set with reveal-style delete.
 *
 * Layout: a fixed red action panel (trash icon) sits behind the row;
 * swiping left translates the main content over it, uncovering the
 * icon. Release past the threshold deletes; tap on the revealed icon
 * deletes too (for users who prefer an explicit hit target).
 *
 * On desktop/pointer devices a long-press (550ms) also triggers
 * delete.
 *
 * Click (no drag) fires onEdit.
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

const SWIPE_REVEAL_WIDTH = 80;
const SWIPE_COMMIT_THRESHOLD = 56;
const LONG_PRESS_MS = 550;
const DRAG_DEAD_ZONE_PX = 5;

const TRASH_ICON = `
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
`;

export class SetRow extends Component {
  constructor(root, props = {}) {
    super(root, props);
    this.startX = 0;
    this.deltaX = 0;
    this.revealed = false;
    this.dragging = false;
    /** @type {number | null} */
    this.longPressTimer = null;
    /** @type {HTMLElement | null} */
    this.main = null;
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
      ? '<svg class="set-row__check" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10l4 4 8-8"/></svg>'
      : '';

    const node = Component.parse(`
      <div class="set-row">
        <button type="button" class="set-row__delete-action" aria-label="Delete set">
          ${TRASH_ICON}
        </button>
        <div class="set-row__main" role="button" tabindex="0">
          <span class="set-row__badge${isDone ? ' set-row__badge--done' : ''}">${setNumber}</span>
          <span class="set-row__data">${reps} × ${weight} kg${rirSuffix}</span>
          ${prBadge}
          ${checkIcon}
        </div>
      </div>
    `);
    this.root.replaceChildren(node);

    this.main = /** @type {HTMLElement} */ (node.querySelector('.set-row__main'));
    const deleteBtn = /** @type {HTMLButtonElement} */ (
      node.querySelector('.set-row__delete-action')
    );

    this.on(this.main, 'click', this.handleClick);
    this.on(this.main, 'pointerdown', this.handlePointerDown);
    this.on(this.main, 'pointermove', this.handlePointerMove);
    this.on(this.main, 'pointerup', this.handlePointerUp);
    this.on(this.main, 'pointercancel', this.handlePointerCancel);
    this.on(deleteBtn, 'click', this.handleDeleteTap);
  }

  handleClick = (event) => {
    // Swallow the click that trails a swipe/long-press so it doesn't
    // trigger edit too.
    if (this.revealed || Math.abs(this.deltaX) > DRAG_DEAD_ZONE_PX) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    haptics.tap();
    /** @type {(() => void) | undefined} */
    (this.props.onEdit)?.();
  };

  handleDeleteTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.fireDelete();
  };

  handlePointerDown = (event) => {
    if (!this.main) return;
    const ev = /** @type {PointerEvent} */ (event);
    this.startX = ev.clientX;
    this.deltaX = 0;
    this.dragging = true;
    this.main.classList.add('set-row__main--dragging');
    this.longPressTimer = /** @type {number} */ (
      /** @type {unknown} */ (setTimeout(() => this.handleLongPress(), LONG_PRESS_MS))
    );
  };

  handlePointerMove = (event) => {
    if (!this.dragging || !this.main) return;
    const ev = /** @type {PointerEvent} */ (event);
    this.deltaX = ev.clientX - this.startX;
    if (Math.abs(this.deltaX) > DRAG_DEAD_ZONE_PX && this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    // Clamp: only left-swipe to reveal, bounded by the action width
    // with a small over-drag allowance so it feels springy.
    const clamped = Math.max(-SWIPE_REVEAL_WIDTH - 20, Math.min(this.deltaX, 0));
    this.main.style.setProperty('--swipe-x', `${clamped}px`);
  };

  handlePointerUp = () => {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (!this.main || !this.dragging) {
      this.dragging = false;
      return;
    }
    this.dragging = false;
    this.main.classList.remove('set-row__main--dragging');

    if (this.deltaX < -SWIPE_COMMIT_THRESHOLD) {
      // Snap to revealed position and wait for the user's tap, OR
      // auto-delete if they dragged all the way over the action.
      if (this.deltaX < -SWIPE_REVEAL_WIDTH - 10) {
        this.fireDelete();
      } else {
        this.revealed = true;
        this.main.style.setProperty('--swipe-x', `-${SWIPE_REVEAL_WIDTH}px`);
      }
    } else {
      this.collapse();
    }
    this.deltaX = 0;
  };

  handlePointerCancel = () => {
    this.handlePointerUp();
  };

  handleLongPress() {
    this.longPressTimer = null;
    this.fireDelete();
  }

  collapse() {
    this.revealed = false;
    this.main?.style.removeProperty('--swipe-x');
  }

  fireDelete() {
    haptics.warning();
    /** @type {(() => void) | undefined} */
    (this.props.onDelete)?.();
  }
}
