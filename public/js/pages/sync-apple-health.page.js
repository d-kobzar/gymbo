import { Page } from './page.base.js';
import { Skeleton } from '../components/skeleton.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';
import { telegram } from '../core/telegram.js';

const INGEST_PATH = '/api/sync/apple-health/ingest';

/**
 * Apple Health connection detail screen.
 *
 * States:
 *   - not connected → primary "Connect" button + manual preview.
 *   - connected → token, copy-to-clipboard, ingest URL, last-sync
 *     timestamp, "Open Shortcut" CTA, destructive disconnect.
 *
 * The manual is numbered step-by-step (install shortcut → paste
 * token → run first time → optional automation). Copy button fires
 * haptics.success on clipboard write.
 */
export class SyncAppleHealthPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {any | null} */
    this.status = null;
    /** @type {string | null} */
    this.token = null;
    /** @type {string | null} */
    this.shortcutUrl = null;
    /** @type {HTMLElement | null} */
    this.bodySlot = null;
  }

  render() {
    const shell = Page.el('div', { className: 'page-shell' });
    shell.append(this.renderHeader());
    this.bodySlot = Page.el('div');
    const sk = Page.el('div');
    new Skeleton(sk, { variant: 'card', height: '400px' }).render();
    this.bodySlot.append(sk);
    shell.append(this.bodySlot);
    this.root.append(shell);
    void this.load();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('span', {
        className: 'page-header__kicker',
        text: i18n.t('sync.apple_health.name').toUpperCase(),
      }),
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('sync.apple_health.title'),
      }),
    );
    return header;
  }

  async load() {
    try {
      const res = /** @type {any} */ (await api.get('/api/sync/status'));
      this.status = res.providers?.apple_health ?? null;
      this.shortcutUrl = this.status?.shortcutUrl ?? null;
      this.renderBody();
    } catch (err) {
      this.handleError(err);
    }
  }

  renderBody() {
    if (!this.bodySlot) return;
    this.bodySlot.replaceChildren();

    const ingestUrl = `${globalThis.location.origin}${INGEST_PATH}`;

    if (this.status?.connected && this.token) {
      this.bodySlot.append(this.renderConnected(ingestUrl));
    } else if (this.status?.connected) {
      // Previously connected in another session — the token is not
      // available anymore (we don't store it plaintext beyond the
      // connect response). Offer to rotate.
      this.bodySlot.append(this.renderRotate());
    } else {
      this.bodySlot.append(this.renderDisconnected(ingestUrl));
    }
  }

  /** @param {string} ingestUrl */
  renderDisconnected(ingestUrl) {
    const wrap = Page.el('div', { className: 'sync-detail' });

    const manual = Page.el('div', { className: 'sync-detail__manual' });
    manual.innerHTML = `
      <h2 class="sync-detail__section-title">${escapeHtml(i18n.t('sync.apple_health.manual_title'))}</h2>
      <ol class="sync-detail__steps">
        <li>${escapeHtml(i18n.t('sync.apple_health.step1'))}</li>
        <li>${escapeHtml(i18n.t('sync.apple_health.step2'))}</li>
        <li>${escapeHtml(i18n.t('sync.apple_health.step3'))}</li>
        <li>${escapeHtml(i18n.t('sync.apple_health.step4'))}</li>
        <li>${escapeHtml(i18n.t('sync.apple_health.step5'))}</li>
      </ol>
    `;
    wrap.append(manual);

    const endpoint = Page.el('div', { className: 'sync-detail__endpoint' });
    endpoint.innerHTML = `
      <span class="input-label">${escapeHtml(i18n.t('sync.apple_health.endpoint_label'))}</span>
      <code class="sync-detail__code">${escapeHtml(ingestUrl)}</code>
    `;
    wrap.append(endpoint);

    const connectBtn = Page.el('button', {
      className: 'button button--primary button--lg button--block',
      text: i18n.t('sync.apple_health.connect'),
    });
    connectBtn.type = 'button';
    this.on(connectBtn, 'click', () => void this.connect());
    wrap.append(connectBtn);

    return wrap;
  }

  renderRotate() {
    const wrap = Page.el('div', { className: 'sync-detail' });
    const msg = Page.el('div', { className: 'sync-detail__note' });
    msg.innerHTML = `
      <p>${escapeHtml(i18n.t('sync.apple_health.rotate_note'))}</p>
    `;
    wrap.append(msg);
    const btn = Page.el('button', {
      className: 'button button--primary button--lg button--block',
      text: i18n.t('sync.apple_health.rotate'),
    });
    btn.type = 'button';
    this.on(btn, 'click', () => void this.connect());
    wrap.append(btn);
    wrap.append(this.renderDisconnectBtn());
    return wrap;
  }

  /** @param {string} ingestUrl */
  renderConnected(ingestUrl) {
    const wrap = Page.el('div', { className: 'sync-detail' });

    const lastSync = this.status?.lastSyncAt
      ? new Date(this.status.lastSyncAt).toLocaleString()
      : i18n.t('sync.apple_health.never_synced');

    const statusEl = Page.el('div', { className: 'sync-detail__status' });
    statusEl.innerHTML = `
      <span class="sync-detail__status-dot"></span>
      <div>
        <div class="sync-detail__status-title">${escapeHtml(i18n.t('sync.connected'))}</div>
        <div class="sync-detail__status-sub">${escapeHtml(i18n.t('sync.apple_health.last_sync'))}: ${escapeHtml(lastSync)}</div>
      </div>
    `;
    wrap.append(statusEl);

    wrap.append(
      this.renderCopyField(
        i18n.t('sync.apple_health.token_label'),
        /** @type {string} */ (this.token),
      ),
      this.renderCopyField(
        i18n.t('sync.apple_health.endpoint_label'),
        ingestUrl,
      ),
    );

    // Preferred install path: the bridge page on our server opens
    // Safari and redirects to shortcuts:// — Telegram's WebView
    // can't launch custom schemes, so we cannot use a direct
    // shortcuts:// href here.
    const installUrl = this.installShortcutUrl();
    if (installUrl) {
      const installBtn = Page.el('button', {
        className: 'button button--primary button--lg button--block',
        text: i18n.t('sync.apple_health.install_shortcut'),
      });
      installBtn.type = 'button';
      this.on(installBtn, 'click', () => {
        haptics.tap();
        telegram.openLink(installUrl);
      });
      wrap.append(installBtn);
    }

    // Alternative: plain iCloud link if the dev published one.
    if (this.shortcutUrl) {
      const openBtn = Page.el('a', {
        className: 'button button--secondary button--block',
        text: i18n.t('sync.apple_health.open_shortcut'),
      });
      openBtn.setAttribute('href', this.shortcutUrl);
      openBtn.setAttribute('target', '_blank');
      openBtn.setAttribute('rel', 'noopener');
      wrap.append(openBtn);
    }

    const manual = Page.el('div', { className: 'sync-detail__manual' });
    manual.innerHTML = `
      <h2 class="sync-detail__section-title">${escapeHtml(i18n.t('sync.apple_health.manual_title'))}</h2>
      <ol class="sync-detail__steps">
        <li>${escapeHtml(i18n.t('sync.apple_health.step1'))}</li>
        <li>${escapeHtml(i18n.t('sync.apple_health.step2'))}</li>
        <li>${escapeHtml(i18n.t('sync.apple_health.step3'))}</li>
        <li>${escapeHtml(i18n.t('sync.apple_health.step4'))}</li>
        <li>${escapeHtml(i18n.t('sync.apple_health.step5'))}</li>
      </ol>
    `;
    wrap.append(manual);

    wrap.append(this.renderDisconnectBtn());
    return wrap;
  }

  /** @param {string} label @param {string} value */
  renderCopyField(label, value) {
    const field = Page.el('div', { className: 'sync-detail__copy' });
    field.innerHTML = `
      <span class="input-label">${escapeHtml(label)}</span>
      <div class="sync-detail__copy-row">
        <code class="sync-detail__code">${escapeHtml(value)}</code>
        <button class="button button--secondary button--sm" type="button">${escapeHtml(i18n.t('sync.copy'))}</button>
      </div>
    `;
    const btn = field.querySelector('button');
    if (btn) {
      this.on(btn, 'click', async () => {
        try {
          await globalThis.navigator?.clipboard?.writeText(value);
          haptics.success();
          toast.show(i18n.t('sync.copied'), { variant: 'success' });
        } catch {
          toast.show(i18n.t('common.error'), { variant: 'error' });
        }
      });
    }
    return field;
  }

  /** HTTPS bridge URL on our server. Telegram's openLink launches
   * this in Safari; Safari runs the embedded redirect to the
   * shortcuts:// scheme. Custom schemes don't work directly from
   * inside Telegram Mini Apps. */
  installShortcutUrl() {
    if (!this.token) return null;
    return `${globalThis.location.origin}/api/sync/apple-health/install?t=${encodeURIComponent(this.token)}`;
  }

  renderDisconnectBtn() {
    const btn = Page.el('button', {
      className: 'button button--ghost button--block',
      text: i18n.t('sync.apple_health.disconnect'),
    });
    btn.type = 'button';
    this.on(btn, 'click', () => void this.disconnect());
    return btn;
  }

  async connect() {
    try {
      const res = /** @type {any} */ (
        await api.post('/api/sync/apple-health/connect', {})
      );
      this.token = res.token;
      this.shortcutUrl = res.shortcutUrl ?? this.shortcutUrl;
      this.status = {
        ...(this.status ?? {}),
        connected: true,
        connectedAt: res.connectedAt,
      };
      haptics.success();
      toast.show(i18n.t('sync.apple_health.connected_toast'), {
        variant: 'success',
      });
      this.renderBody();
    } catch (err) {
      this.handleError(err);
    }
  }

  async disconnect() {
    if (!globalThis.confirm?.(i18n.t('sync.apple_health.disconnect_confirm'))) return;
    try {
      await api.del('/api/sync/apple-health');
      this.token = null;
      this.status = { connected: false, connectedAt: null, lastSyncAt: null };
      haptics.warning();
      toast.show(i18n.t('sync.apple_health.disconnected_toast'), {
        variant: 'success',
      });
      this.renderBody();
    } catch (err) {
      this.handleError(err);
    }
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
