import { Page } from './page.base.js';
import { Skeleton } from '../components/skeleton.js';
import { StatCard } from '../components/stat-card.js';
import { EmptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { api } from '../core/api.js';
import { ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';

const MAX_PR_ITEMS = 5;

/**
 * Home dashboard:
 *   - "Continue" card (last logged set → /log prefilled) — hidden
 *     when there is no history.
 *   - 2×2 stat grid: sets-this-week, total sets, body weight,
 *     exercises count.
 *   - Personal records (top 5) — empty state when none.
 *   - Pull-to-refresh gesture reloads all data.
 *
 * Per user directive: NO AI coach tip block on Home. The assistant
 * lives inside the Telegram bot only.
 */
export class HomePage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    this.shell = null;
    /** @type {HTMLElement | null} */
    this.continueSlot = null;
    /** @type {HTMLElement | null} */
    this.statsSlot = null;
    /** @type {HTMLElement | null} */
    this.prSlot = null;
    this.pullStartY = 0;
    this.pullDelta = 0;
    this.isPulling = false;
  }

  render() {
    this.shell = Page.el('div', { className: 'page-shell' });

    this.shell.append(this.renderHeader());

    this.continueSlot = Page.el('div');
    this.shell.append(this.continueSlot);

    this.shell.append(this.renderStatsSection());
    this.shell.append(this.renderPrSection());

    this.root.append(this.shell);

    this.on(this.root, 'touchstart', this.handlePullStart, { passive: true });
    this.on(this.root, 'touchmove', this.handlePullMove, { passive: false });
    this.on(this.root, 'touchend', this.handlePullEnd, { passive: true });

    void this.load();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('span', {
        className: 'page-header__kicker',
        text: this.weekDateRange(),
      }),
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('dashboard.greeting'),
      }),
    );
    return header;
  }

  renderStatsSection() {
    const section = Page.section('');
    this.statsSlot = Page.el('div', { className: 'grid-2' });
    for (let i = 0; i < 4; i++) {
      const slot = Page.el('div');
      new StatCard(slot, { label: '...', value: null }).render();
      this.statsSlot.append(slot);
    }
    section.append(this.statsSlot);
    return section;
  }

  renderPrSection() {
    const section = Page.section(i18n.t('dashboard.personal_records'));
    this.prSlot = Page.el('div', { className: 'pr-list' });
    for (let i = 0; i < 3; i++) {
      const sk = Page.el('div');
      new Skeleton(sk, { variant: 'card', height: '56px' }).render();
      this.prSlot.append(sk);
    }
    section.append(this.prSlot);
    return section;
  }

  async load() {
    try {
      const [dashboard, prs, recent] = await Promise.all([
        api.get('/api/stats/dashboard'),
        api.get('/api/stats/prs'),
        api.get('/api/training-logs?limit=1&page=1'),
      ]);
      this.renderStats(/** @type {DashboardData} */ (dashboard));
      this.renderPrs(/** @type {PrEntry[]} */ (prs));
      this.renderContinue(/** @type {{ data: Array<any> }} */ (recent));
    } catch (err) {
      this.handleLoadError(err);
    }
  }

  /** @param {DashboardData} data */
  renderStats(data) {
    if (!this.statsSlot) return;
    const labels = [
      {
        label: i18n.t('dashboard.sets_this_week'),
        value: String(data.setsThisWeek ?? 0),
      },
      {
        label: i18n.t('dashboard.total_sets'),
        value: String(data.totalSets ?? 0),
      },
      {
        label: i18n.t('dashboard.body_weight'),
        value: data.bodyWeight != null ? String(data.bodyWeight) : '—',
        unit: data.bodyWeight != null ? 'KG' : undefined,
      },
      {
        label: i18n.t('dashboard.exercises_count'),
        value: String(data.exerciseCount ?? 0),
      },
    ];
    this.statsSlot.replaceChildren();
    for (const stat of labels) {
      const slot = Page.el('div');
      new StatCard(slot, stat).render();
      this.statsSlot.append(slot);
    }
  }

  /** @param {PrEntry[]} prs */
  renderPrs(prs) {
    if (!this.prSlot) return;
    this.prSlot.replaceChildren();

    const top = prs
      .filter((p) => p?.exercise?.name)
      .sort((a, b) => Number(b.maxWeight ?? 0) - Number(a.maxWeight ?? 0))
      .slice(0, MAX_PR_ITEMS);

    if (top.length === 0) {
      const host = Page.el('div');
      new EmptyState(host, {
        icon:
          '<svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12h24M12 24h24M12 36h12"/></svg>',
        heading: i18n.t('dashboard.no_workouts'),
        cta: {
          label: i18n.t('workout.add_set'),
          onClick: () => {
            globalThis.location.hash = '/log';
          },
        },
      }).render();
      this.prSlot.append(host);
      return;
    }

    for (const pr of top) {
      const row = Page.el('div', { className: 'pr-row' });
      row.innerHTML = `
        <span class="pr-row__accent" aria-hidden="true"></span>
        <span class="pr-row__name">${escapeHtml(pr.exercise.name)}</span>
        <span class="pr-row__data">${Number(pr.maxReps ?? 0)} × ${Number(pr.maxWeight ?? 0)} kg</span>
      `;
      this.prSlot.append(row);
    }
  }

  /** @param {{ data: Array<{ exercise?: { name: string } }> }} recent */
  renderContinue(recent) {
    if (!this.continueSlot) return;
    const rows = Array.isArray(recent?.data) ? recent.data : [];
    const last = rows[0];
    if (!last || !last.exercise?.name) {
      this.continueSlot.replaceChildren();
      return;
    }
    const card = Page.el('button', { className: 'card card--hero continue-card' });
    card.type = 'button';
    card.innerHTML = `
      <span class="card__kicker">${escapeHtml(i18n.t('dashboard.recent_workouts'))}</span>
      <span class="card__title">${escapeHtml(last.exercise.name)}</span>
      <span class="card__watermark" aria-hidden="true">→</span>
    `;
    this.on(card, 'click', () => {
      haptics.tap();
      globalThis.location.hash = `/log?exercise=${encodeURIComponent(last.exercise.name)}`;
    });
    this.continueSlot.replaceChildren(card);
  }

  /** @param {unknown} err */
  handleLoadError(err) {
    if (err instanceof NetworkError) {
      toast.show('Network error. Check your connection.', {
        variant: 'error',
        action: { label: 'Retry', onClick: () => void this.load() },
      });
      return;
    }
    if (err instanceof ApiError) {
      toast.show(err.message, { variant: 'error' });
      return;
    }
    toast.show(i18n.t('common.error'), { variant: 'error' });
  }

  weekDateRange() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    const weekNum = Math.ceil(
      ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 +
        new Date(now.getFullYear(), 0, 1).getDay() +
        1) /
        7,
    );
    return `W${weekNum} · ${fmt(start)} — ${fmt(end)}`;
  }

  handlePullStart = (event) => {
    if (this.root.scrollTop > 0) return;
    this.pullStartY = /** @type {TouchEvent} */ (event).touches[0].clientY;
    this.pullDelta = 0;
    this.isPulling = true;
  };

  handlePullMove = (event) => {
    if (!this.isPulling) return;
    const touch = /** @type {TouchEvent} */ (event).touches[0];
    const delta = touch.clientY - this.pullStartY;
    if (delta > 0 && this.root.scrollTop <= 0) {
      this.pullDelta = Math.min(delta, 120);
      this.shell && (this.shell.style.transform = `translateY(${this.pullDelta}px)`);
    }
  };

  handlePullEnd = () => {
    if (!this.isPulling) return;
    this.isPulling = false;
    if (this.shell) {
      this.shell.style.transition = 'transform 200ms var(--ease-out)';
      this.shell.style.transform = '';
      setTimeout(() => {
        if (this.shell) this.shell.style.transition = '';
      }, 220);
    }
    if (this.pullDelta > 80) {
      haptics.bump();
      void this.load();
    }
    this.pullDelta = 0;
  };
}

/**
 * @typedef {object} DashboardData
 * @property {number} setsThisWeek
 * @property {number} totalSets
 * @property {number | null} bodyWeight
 * @property {number} exerciseCount
 * @property {number} workoutDays
 */

/**
 * @typedef {object} PrEntry
 * @property {number} exerciseId
 * @property {number | string} maxWeight
 * @property {number | string} maxReps
 * @property {{ name: string }} exercise
 */

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
