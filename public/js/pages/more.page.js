import { Page } from './page.base.js';
import { haptics } from '../core/haptics.js';
import { i18n } from '../core/i18n.js';

const APP_VERSION = '2.0';

const ICONS = {
  settings:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  program:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  measurements:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M7 9v6"/><path d="M12 8v8"/><path d="M17 9v6"/></svg>',
  exercises:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5L17.5 17.5"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 22l4-4"/><path d="M2 6l4-4"/><path d="M3 10l7-7"/><path d="M14 21l7-7"/></svg>',
  support:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  about:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
};

/**
 * More page — the catch-all menu. Routes to sibling pages that don't
 * fit in the bottom nav (Program, Measurements, Exercises, Settings)
 * plus external support / about rows.
 */
export class MorePage extends Page {
  render() {
    const shell = Page.el('div', { className: 'page-shell' });
    shell.append(this.renderHeader());
    shell.append(this.renderList());
    shell.append(this.renderFooter());
    this.root.append(shell);
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('h1', { className: 'page-header__title', text: i18n.t('nav.more') }),
    );
    return header;
  }

  renderList() {
    const list = Page.el('div', { className: 'more-list' });
    const items = [
      {
        icon: ICONS.program,
        label: i18n.t('nav.program'),
        sub: i18n.t('more.program_sub'),
        href: '#/program',
      },
      {
        icon: ICONS.measurements,
        label: i18n.t('measurements.page_title'),
        sub: i18n.t('more.measurements_sub'),
        href: '#/measurements',
      },
      {
        icon: ICONS.exercises,
        label: i18n.t('nav.exercises'),
        sub: i18n.t('more.exercises_sub'),
        href: '#/exercises',
      },
      {
        icon: ICONS.settings,
        label: i18n.t('settings.title'),
        sub: i18n.t('more.settings_sub'),
        href: '#/settings',
      },
      {
        icon: ICONS.support,
        label: i18n.t('more.support'),
        sub: i18n.t('more.support_sub'),
        href: 'https://t.me/GymBoSupport',
        external: true,
      },
      {
        icon: ICONS.about,
        label: i18n.t('more.about'),
        sub: i18n.t('more.version_sub', { version: APP_VERSION }),
        href: '#/about-stub',
      },
    ];

    for (const it of items) {
      const row = Page.el(it.external ? 'a' : 'button', { className: 'more-item' });
      if (it.external) {
        /** @type {HTMLAnchorElement} */ (row).href = it.href;
        /** @type {HTMLAnchorElement} */ (row).target = '_blank';
        /** @type {HTMLAnchorElement} */ (row).rel = 'noopener noreferrer';
      } else {
        /** @type {HTMLButtonElement} */ (row).type = 'button';
        this.on(row, 'click', () => {
          haptics.tap();
          globalThis.location.hash = it.href.replace(/^#/, '');
        });
      }
      row.innerHTML = `
        <span class="more-item__icon" aria-hidden="true">${it.icon}</span>
        <span class="more-item__text">
          <span class="more-item__label">${escapeHtml(it.label)}</span>
          <span class="more-item__sub">${escapeHtml(it.sub)}</span>
        </span>
        <span class="more-item__chevron" aria-hidden="true">
          <svg width="12" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
      `;
      list.append(row);
    }
    return list;
  }

  renderFooter() {
    return Page.el('footer', {
      className: 'more-footer',
      text: `GYMBO · V${APP_VERSION}`,
    });
  }
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
