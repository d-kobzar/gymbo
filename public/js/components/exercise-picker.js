import { Component } from './component.js';
import { BottomSheet } from './bottom-sheet.js';
import { haptics } from '../core/haptics.js';

const VIRTUAL_THRESHOLD = 100;
const ROW_HEIGHT = 66; // match .exercise-picker__item min-height + gap

/**
 * Exercise picker — renders a searchable list inside a BottomSheet.
 * Virtualizes when items.length > 100 to keep scroll smooth on
 * low-end devices.
 *
 * props:
 *   items: Array<{ id: number, name: string, meta?: string }>
 *   onSelect: (id: number) => void
 */
export class ExercisePicker extends Component {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {BottomSheet | null} */
    this.sheet = null;
    /** @type {HTMLInputElement | null} */
    this.searchEl = null;
    /** @type {HTMLElement | null} */
    this.listEl = null;
    this.filter = '';
  }

  open() {
    this.sheet = new BottomSheet(document.body, {
      title: this.props.title ?? 'Select exercise',
      onClose: () => this.destroy(),
    });
    this.sheet.render();

    const body = Component.parse(`
      <div>
        <div class="exercise-picker__search">
          <input class="input" type="search" placeholder="Search…" autocomplete="off" />
        </div>
        <div class="exercise-picker__list" role="listbox"></div>
      </div>
    `);
    this.sheet.setBody(body);

    this.searchEl = /** @type {HTMLInputElement} */ (body.querySelector('input'));
    this.listEl = /** @type {HTMLElement} */ (body.querySelector('.exercise-picker__list'));

    this.on(this.searchEl, 'input', () => {
      this.filter = this.searchEl?.value.trim().toLowerCase() ?? '';
      this.renderList();
    });

    this.on(this.listEl, 'click', (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      const btn = target.closest('[data-id]');
      if (!(btn instanceof HTMLElement)) return;
      const id = Number(btn.dataset.id);
      if (Number.isFinite(id)) {
        haptics.select();
        const onSelect = /** @type {((id: number) => void) | undefined} */ (
          this.props.onSelect
        );
        onSelect?.(id);
        this.sheet?.close();
      }
    });

    this.renderList();
    this.sheet.open();
  }

  renderList() {
    if (!this.listEl) return;
    const items = /** @type {Array<{id:number,name:string,meta?:string}>} */ (
      this.props.items ?? []
    );
    const filtered = this.filter
      ? items.filter((it) => it.name.toLowerCase().includes(this.filter))
      : items;

    // Naive render for small lists; virtualize only beyond threshold.
    if (filtered.length <= VIRTUAL_THRESHOLD) {
      this.listEl.style.height = '';
      this.listEl.replaceChildren(
        ...filtered.map((it) => this.renderItem(it)),
      );
      return;
    }

    this.listEl.style.height = `${filtered.length * ROW_HEIGHT}px`;
    this.listEl.style.position = 'relative';
    const render = () => {
      if (!this.listEl) return;
      const viewportTop = this.listEl.scrollTop;
      const viewportBottom = viewportTop + this.listEl.clientHeight;
      const startIdx = Math.max(0, Math.floor(viewportTop / ROW_HEIGHT) - 4);
      const endIdx = Math.min(
        filtered.length,
        Math.ceil(viewportBottom / ROW_HEIGHT) + 4,
      );
      const slice = filtered.slice(startIdx, endIdx);
      this.listEl.replaceChildren(
        ...slice.map((it, i) => {
          const el = this.renderItem(it);
          el.style.position = 'absolute';
          el.style.top = `${(startIdx + i) * ROW_HEIGHT}px`;
          el.style.left = '0';
          el.style.right = '0';
          return el;
        }),
      );
    };
    render();
    this.on(this.listEl, 'scroll', render, { passive: true });
  }

  /**
   * @param {{id:number,name:string,meta?:string}} item
   * @returns {HTMLElement}
   */
  renderItem(item) {
    const initial = item.name.charAt(0).toUpperCase();
    const meta = item.meta ? escapeHtml(item.meta) : '';
    const name = escapeHtml(item.name);
    const el = Component.parse(`
      <button class="exercise-picker__item" type="button" data-id="${item.id}" role="option">
        <span class="exercise-picker__avatar">${initial}</span>
        <span class="exercise-picker__name">${name}</span>
        <span class="exercise-picker__meta">${meta}</span>
      </button>
    `);
    return el;
  }

  destroy() {
    super.destroy();
    this.sheet?.destroy();
    this.sheet = null;
    this.searchEl = null;
    this.listEl = null;
  }
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
