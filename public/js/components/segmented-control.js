import { Component } from './component.js';
import { haptics } from '../core/haptics.js';

/**
 * Segmented control — one active option at a time.
 *
 * props:
 *   options: Array<{ id: string, label: string }>
 *   value: string
 *   block?: boolean       // full-width grid
 *   onChange: (id: string) => void
 */
export class SegmentedControl extends Component {
  render() {
    const options = /** @type {Array<{id: string, label: string}>} */ (
      this.props.options ?? []
    );
    const value = /** @type {string} */ (this.props.value);
    const block = this.props.block ? ' segmented-control--block' : '';

    const node = Component.parse(`<div class="segmented-control${block}" role="tablist"></div>`);

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `segmented-control__option${
        opt.id === value ? ' segmented-control__option--active' : ''
      }`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', opt.id === value ? 'true' : 'false');
      btn.dataset.id = opt.id;
      btn.textContent = opt.label;
      node.appendChild(btn);
    }

    this.on(node, 'click', (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      const btn = target.closest('.segmented-control__option');
      if (!(btn instanceof HTMLElement) || !btn.dataset.id) return;
      haptics.select();
      // Self-manage active state — callers only pass onChange, they
      // don't re-render us. Without this the visual selection would
      // stick on whatever was initially `value`.
      for (const el of node.querySelectorAll('.segmented-control__option')) {
        const isActive = el === btn;
        el.classList.toggle('segmented-control__option--active', isActive);
        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
      const onChange = /** @type {((id: string) => void) | undefined} */ (this.props.onChange);
      onChange?.(btn.dataset.id);
    });

    this.root.replaceChildren(node);
  }
}
