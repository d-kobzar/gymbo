import { Component } from './component.js';
import { haptics } from '../core/haptics.js';

/**
 * Empty state: icon + heading + description + optional primary CTA.
 * Use in place of bare "no data" text everywhere.
 *
 * props:
 *   icon?: string           SVG string
 *   heading: string
 *   description?: string
 *   cta?: { label: string, onClick: () => void }
 */
export class EmptyState extends Component {
  render() {
    const icon = /** @type {string|undefined} */ (this.props.icon);
    const heading = /** @type {string} */ (this.props.heading ?? '');
    const description = /** @type {string|undefined} */ (this.props.description);

    const node = Component.parse('<section class="empty-state"></section>');

    if (icon) {
      const wrap = document.createElement('span');
      wrap.className = 'empty-state__icon';
      wrap.innerHTML = icon;
      node.appendChild(wrap);
    }

    const h = document.createElement('h2');
    h.className = 'empty-state__heading';
    h.textContent = heading;
    node.appendChild(h);

    if (description) {
      const p = document.createElement('p');
      p.className = 'empty-state__description';
      p.textContent = description;
      node.appendChild(p);
    }

    const cta = /** @type {{label: string, onClick: () => void}|undefined} */ (
      this.props.cta
    );
    if (cta) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'button button--primary button--lg';
      btn.textContent = cta.label;
      this.on(btn, 'click', () => {
        haptics.tap();
        cta.onClick();
      });
      node.appendChild(btn);
    }

    this.root.replaceChildren(node);
  }
}
