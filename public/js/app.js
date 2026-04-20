/**
 * GymBo Mini App — ESM entry point.
 *
 * Boots in this order:
 *   1. Pull CSS into the bundle so Vite emits both assets together.
 *   2. Initialize Telegram WebApp (expand, haptic-ready).
 *   3. Apply the persisted theme (V2 by default; `data-theme="tg"`
 *      only when the user explicitly opts in via Settings).
 *   4. Authenticate via Telegram initData → JWT.
 *   5. Load locales + set language from Telegram user.
 *   6. Fetch /api/users/me to learn onboarding state.
 *   7. Mount the persistent shell (#page-container + #bottom-nav).
 *   8. If onboarded: register routes and start the hash router.
 *      If NOT onboarded: force-render the OnboardingPage and keep
 *      the bottom-nav hidden until completion.
 */

import '../styles/index.css';

import { telegram } from './core/telegram.js';
import { api } from './core/api.js';
import { i18n } from './core/i18n.js';
import { Router } from './core/router.js';
import { toast } from './components/toast.js';
import { BottomNav } from './components/bottom-nav.js';

import { HomePage } from './pages/home.page.js';
import { LogPage } from './pages/log.page.js';
import { ProgressPage } from './pages/progress.page.js';
import { ProgramPage } from './pages/program.page.js';
import { ProgramEditorPage } from './pages/program-editor.page.js';
import { MeasurementsPage } from './pages/measurements.page.js';
import { ExercisesPage } from './pages/exercises.page.js';
import { SettingsPage } from './pages/settings.page.js';
import { MorePage } from './pages/more.page.js';
import { OnboardingPage } from './pages/onboarding.page.js';

const ICONS = {
  home:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  log:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  progress:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  more:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
};

async function boot() {
  try {
    telegram.ready();
    telegram.expand();
    applyPersistedTheme();
    await Promise.all([api.authenticateWithTelegram(), i18n.load()]);
    i18n.setLang(i18n.detectLang(telegram.user?.language_code));

    const me = await api.get('/api/users/me').catch(() => null);

    if (!me?.onboardedAt) {
      mountOnboarding();
    } else {
      mountShell();
    }
  } catch (err) {
    // eslint-disable-next-line no-console -- critical boot failure signal
    console.error('[GymBo] boot failed', err);
    toast.show('Failed to start the app. Please reload.', { variant: 'error' });
  }
}

function applyPersistedTheme() {
  try {
    const theme = globalThis.localStorage?.getItem('gymbo_theme');
    if (theme === 'tg') {
      document.documentElement.setAttribute('data-theme', 'tg');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  } catch {
    /* storage unavailable — stick with V2 default */
  }
}

function mountOnboarding() {
  const pageContainer = document.getElementById('page-container');
  const navHost = document.getElementById('bottom-nav');
  if (!pageContainer || !navHost) {
    throw new Error('Shell mount points missing in index.html');
  }
  navHost.style.display = 'none';

  const page = new OnboardingPage(pageContainer, {});
  page.render();

  // Reboot once onboarding succeeds — simplest way to pick up the
  // now-true `onboardedAt` flag and switch to the real shell.
  globalThis.addEventListener('hashchange', () => {
    if (globalThis.location.hash.startsWith('#/home')) {
      page.destroy();
      pageContainer.replaceChildren();
      void boot();
    }
  }, { once: true });
}

function mountShell() {
  const pageContainer = document.getElementById('page-container');
  const navHost = document.getElementById('bottom-nav');
  if (!pageContainer || !navHost) {
    throw new Error('Shell mount points missing in index.html');
  }
  navHost.style.display = '';
  pageContainer.style.transition = 'opacity var(--duration-fast) var(--ease-out)';

  const nav = new BottomNav(navHost, {
    tabs: [
      { id: 'home', label: i18n.t('nav.home'), icon: ICONS.home, path: '/home' },
      { id: 'log', label: i18n.t('nav.log'), icon: ICONS.log, path: '/log' },
      { id: 'progress', label: i18n.t('nav.progress'), icon: ICONS.progress, path: '/progress' },
      { id: 'more', label: i18n.t('nav.more'), icon: ICONS.more, path: '/more' },
    ],
  });
  nav.render();

  const router = new Router(pageContainer);
  router.register('/home', mountPage(HomePage));
  router.register('/log', mountPage(LogPage));
  router.register('/progress', mountPage(ProgressPage));
  router.register('/program', mountPage(ProgramPage));
  router.register('/program/edit', mountPage(ProgramEditorPage));
  router.register('/measurements', mountPage(MeasurementsPage));
  router.register('/exercises', mountPage(ExercisesPage));
  router.register('/settings', mountPage(SettingsPage));
  router.register('/more', mountPage(MorePage));
  router.start();
}

/**
 * @param {new (root: HTMLElement, props: Record<string, unknown>) => { render: () => void, destroy: () => void }} PageCtor
 */
function mountPage(PageCtor) {
  return (container, params) => {
    const page = new PageCtor(container, { params });
    page.render();
    return page;
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
