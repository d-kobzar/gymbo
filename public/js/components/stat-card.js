import { Component } from './component.js';
import { Skeleton } from './skeleton.js';

/**
 * Stat card: label + value + optional unit and trend. Renders a
 * Skeleton while props.value is null/undefined — never an em-dash.
 *
 * props:
 *   label: string
 *   value: string | number | null
 *   unit?: string
 *   trend?: { direction: 'up' | 'down', text: string }
 *   accent?: boolean
 */
export class StatCard extends Component {
  render() {
    const label = escapeHtml(String(this.props.label ?? ''));
    const accent = this.props.accent ? ' stat-card--accent' : '';

    const node = Component.parse(`
      <article class="stat-card${accent}">
        <span class="stat-card__label">${label}</span>
        <div class="stat-card__body"></div>
      </article>
    `);
    this.root.replaceChildren(node);

    const body = /** @type {HTMLElement} */ (node.querySelector('.stat-card__body'));

    if (this.props.value == null) {
      new Skeleton(body, { variant: 'line', width: '50%', height: '28px' }).render();
      return;
    }

    const valueEl = document.createElement('span');
    valueEl.className = 'stat-card__value';
    valueEl.textContent = String(this.props.value);
    body.appendChild(valueEl);

    if (this.props.unit) {
      const unitEl = document.createElement('span');
      unitEl.className = 'stat-card__unit';
      unitEl.textContent = String(this.props.unit);
      body.appendChild(unitEl);
    }

    if (this.props.trend) {
      const trend = /** @type {{ direction: 'up'|'down', text: string }} */ (
        this.props.trend
      );
      const trendEl = document.createElement('span');
      trendEl.className = `stat-card__trend stat-card__trend--${trend.direction}`;
      trendEl.textContent = trend.text;
      node.appendChild(trendEl);
    }
  }
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
