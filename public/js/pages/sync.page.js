import { Page } from './page.base.js';
import { Skeleton } from '../components/skeleton.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';

/**
 * Hub page for external-data sync providers. Each provider is a
 * card with status badge + last-sync timestamp + tap target to its
 * own detail screen. MVP: Apple Health live, Strava / Garmin as
 * "coming soon".
 */
export class SyncPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {any | null} */
    this.status = null;
    /** @type {HTMLElement | null} */
    this.listSlot = null;
  }

  render() {
    const shell = Page.el('div', { className: 'page-shell' });
    shell.append(this.renderHeader());

    this.listSlot = Page.el('div', { className: 'sync-list' });
    const sk = Page.el('div');
    new Skeleton(sk, { variant: 'card', height: '280px' }).render();
    this.listSlot.append(sk);
    shell.append(this.listSlot);

    this.root.append(shell);
    void this.load();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('sync.title'),
      }),
      Page.el('span', {
        className: 'page-header__kicker',
        text: i18n.t('sync.subtitle'),
      }),
    );
    return header;
  }

  async load() {
    try {
      this.status = await api.get('/api/sync/status');
      this.renderList();
    } catch (err) {
      this.handleError(err);
    }
  }

  renderList() {
    if (!this.listSlot || !this.status) return;
    this.listSlot.replaceChildren();

    this.listSlot.append(
      this.renderCard({
        id: 'apple_health',
        name: i18n.t('sync.apple_health.name'),
        description: i18n.t('sync.apple_health.description'),
        status: this.status.providers?.apple_health,
        available: true,
        route: '/sync/apple-health',
        logo: 'apple',
      }),
      this.renderCard({
        id: 'strava',
        name: i18n.t('sync.strava.name'),
        description: i18n.t('sync.strava.description'),
        status: this.status.providers?.strava,
        available: false,
        logo: 'strava',
      }),
      this.renderCard({
        id: 'garmin',
        name: i18n.t('sync.garmin.name'),
        description: i18n.t('sync.garmin.description'),
        status: this.status.providers?.garmin,
        available: false,
        logo: 'garmin',
      }),
    );
  }

  renderCard({ name, description, status, available, route, logo }) {
    const card = Page.el('button', {
      className: `sync-card${available ? '' : ' sync-card--disabled'}`,
    });
    card.type = 'button';

    const badge = status?.connected
      ? `<span class="sync-card__badge sync-card__badge--on">${escapeHtml(i18n.t('sync.connected'))}</span>`
      : available
        ? `<span class="sync-card__badge">${escapeHtml(i18n.t('sync.not_connected'))}</span>`
        : `<span class="sync-card__badge sync-card__badge--muted">${escapeHtml(i18n.t('sync.coming_soon'))}</span>`;

    card.innerHTML = `
      <div class="sync-card__head">
        <div class="sync-card__logo sync-card__logo--${logo}">${logoSvg(logo)}</div>
        <div class="sync-card__title">
          <span class="sync-card__name">${escapeHtml(name)}</span>
          ${badge}
        </div>
        <span class="sync-card__chevron" aria-hidden="true">
          <svg width="14" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
      </div>
      <p class="sync-card__description">${escapeHtml(description)}</p>
    `;

    if (available && route) {
      this.on(card, 'click', () => {
        haptics.tap();
        globalThis.location.hash = route;
      });
    } else {
      card.disabled = true;
    }
    return card;
  }

  /** @param {unknown} err */
  handleError(err) {
    if (err instanceof NetworkError) toast.show(i18n.t('toasts.network_error'), { variant: 'error' });
    else if (err instanceof ApiError) toast.show(err.message, { variant: 'error' });
    else toast.show(i18n.t('common.error'), { variant: 'error' });
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Monochrome inline SVG — matches the V2 palette */
function logoSvg(name) {
  if (name === 'apple') {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`;
  }
  if (name === 'strava') {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>`;
  }
  if (name === 'garmin') {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 018 8 8 8 0 01-8 8 8 8 0 01-8-8 8 8 0 018-8zm0 3a5 5 0 00-5 5 5 5 0 005 5 5 5 0 005-5 5 5 0 00-5-5z"/></svg>`;
  }
  return '';
}
