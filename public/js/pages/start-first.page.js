import { Page } from './page.base.js';
import { api } from '../core/api.js';
import { haptics } from '../core/haptics.js';
import { i18n } from '../core/i18n.js';
import { telegram } from '../core/telegram.js';
import { toast } from '../components/toast.js';

const BOT_USERNAME_ENV = 'GymBoBot'; // TODO: wire through config on the backend if it ever changes.

/**
 * Rendered when /api/auth/telegram responds with BOT_NOT_STARTED.
 * Tells the user to open the bot and press /start — without that
 * we don't have a chatId to send notifications to, so the coach
 * can't reach them.
 *
 * Props:
 *   onRetry?: () => Promise<void>   — called after a successful retry.
 */
export class StartFirstPage extends Page {
  render() {
    hideBottomNav();

    const shell = Page.el('div', { className: 'onboarding-shell' });

    const header = Page.el('div', { className: 'onboarding-header' });
    header.append(
      Page.el('span', {
        className: 'onboarding-header__kicker',
        text: i18n.t('app.name'),
      }),
      Page.el('h1', {
        className: 'onboarding-header__title',
        text: i18n.t('start.title'),
      }),
      Page.el('p', {
        className: 'onboarding-header__hint',
        text: i18n.t('start.description'),
      }),
    );
    shell.append(header);

    // Big visual anchor — amber hero card mirrors the home "continue" card.
    const hero = Page.el('div', { className: 'card card--hero' });
    hero.innerHTML = `
      <span class="card__kicker">/START</span>
      <span class="card__title">${escapeHtml(i18n.t('start.open_bot'))}</span>
      <span class="card__watermark" aria-hidden="true">→</span>
    `;
    shell.append(hero);

    const actions = Page.el('div', { className: 'onboarding-actions' });

    const openBotBtn = Page.el('button', {
      className: 'button button--primary button--lg',
      text: i18n.t('start.open_bot'),
    });
    openBotBtn.type = 'button';
    this.on(openBotBtn, 'click', () => {
      haptics.tap();
      // We don't have the bot username from the server, but the
      // Mini App itself opens from a bot — closing the WebApp
      // returns the user to the conversation.
      if (telegram.isAvailable) telegram.close();
      else globalThis.open(`https://t.me/${BOT_USERNAME_ENV}`, '_blank');
    });

    const retryBtn = Page.el('button', {
      className: 'button button--ghost button--lg',
      text: i18n.t('start.retry'),
    });
    retryBtn.type = 'button';
    this.on(retryBtn, 'click', async () => {
      haptics.tap();
      const result = await api.authenticateWithTelegram();
      if (result.ok) {
        const onRetry = /** @type {(() => Promise<void>) | undefined} */ (
          this.props.onRetry
        );
        if (onRetry) await onRetry();
      } else if (result.needsStart) {
        toast.show(i18n.t('start.description'), { variant: 'warning' });
      } else {
        toast.show(i18n.t('toasts.network_error'), { variant: 'error' });
      }
    });

    actions.append(openBotBtn, retryBtn);
    shell.append(actions);

    this.root.append(shell);
  }

  destroy() {
    showBottomNav();
    super.destroy();
  }
}

function hideBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = 'none';
}

function showBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = '';
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
