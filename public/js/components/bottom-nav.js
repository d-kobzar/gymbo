import { Component } from './component.js';
import { haptics } from '../core/haptics.js';

/**
 * Bottom navigation: 4 tabs (Home · Log · Progress · More). Updates
 * the active tab on hashchange. Haptics on tap.
 *
 * props:
 *   tabs: Array<{ id: string, label: string, icon: string, path: string }>
 */
export class BottomNav extends Component {
  constructor(root, props = {}) {
    super(root, props);
    this.current = '';
    this.handleHash = () => this.syncActive();
  }

  render() {
    const tabs = /** @type {Array<{id:string,label:string,icon:string,path:string}>} */ (
      this.props.tabs ?? []
    );
    const nav = Component.parse('<nav class="bottom-nav" role="tablist" aria-label="Main"></nav>');

    for (const tab of tabs) {
      const a = document.createElement('a');
      a.className = 'bottom-nav__item';
      a.href = `#${tab.path}`;
      a.dataset.id = tab.id;
      a.setAttribute('role', 'tab');
      a.innerHTML = `
        <span class="bottom-nav__icon" aria-hidden="true">${tab.icon}</span>
        <span>${escapeHtml(tab.label)}</span>
      `;
      nav.append(a);
    }

    this.on(nav, 'click', (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      if (target.closest('.bottom-nav__item')) haptics.select();
    });

    this.on(globalThis, 'hashchange', this.handleHash);
    this.root.replaceChildren(nav);
    this.syncActive();
  }

  syncActive() {
    const nav = /** @type {HTMLElement | null} */ (this.root.firstElementChild);
    if (!nav) return;
    const hash = globalThis.location.hash.slice(1) || '/home';
    const topSegment = hash.split('?')[0].split('/')[1] ?? 'home';
    for (const item of nav.querySelectorAll('.bottom-nav__item')) {
      const el = /** @type {HTMLElement} */ (item);
      const active = el.dataset.id === topSegment;
      el.classList.toggle('bottom-nav__item--active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }
}

/** @param {string} s */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
