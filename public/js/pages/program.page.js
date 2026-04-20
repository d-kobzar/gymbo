import { Page } from './page.base.js';
import { BottomSheet } from '../components/bottom-sheet.js';
import { Skeleton } from '../components/skeleton.js';
import { EmptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SHORT_DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/**
 * Program page — week strip + day cards. Tap a day to see its
 * exercises in a bottom sheet. Read-only in Phase 6 — creation
 * flow stays behind the existing POST endpoint.
 */
export class ProgramPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {any | null} */
    this.program = null;
    /** @type {HTMLElement | null} */
    this.daysSlot = null;
  }

  render() {
    const shell = Page.el('div', { className: 'page-shell' });
    shell.append(this.renderHeader());
    shell.append(this.renderWeekStrip());

    this.daysSlot = Page.el('div', { className: 'page-section' });
    const skeleton = Page.el('div');
    new Skeleton(skeleton, { variant: 'card', height: '80px' }).render();
    this.daysSlot.append(skeleton);
    shell.append(this.daysSlot);

    shell.append(this.renderEditCta());

    this.root.append(shell);
    void this.load();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('program.title'),
      }),
      Page.el('span', {
        className: 'page-header__kicker',
        text: i18n.t('program.subtitle'),
      }),
    );
    return header;
  }

  renderEditCta() {
    const btn = Page.el('button', {
      className: 'button button--secondary button--lg button--block',
      text: i18n.t('program.new_version'),
    });
    btn.type = 'button';
    this.on(btn, 'click', () => {
      haptics.tap();
      globalThis.location.hash = '/program/edit';
    });
    return btn;
  }

  renderWeekStrip() {
    const strip = Page.el('div', { className: 'week-strip' });
    const today = new Date();
    const monday = new Date(today);
    const shift = (today.getDay() + 6) % 7;
    monday.setDate(today.getDate() - shift);
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();
      const day = Page.el('div', {
        className: `week-strip__day${isToday ? ' week-strip__day--today' : ''}`,
      });
      day.append(
        Page.el('span', { className: 'week-strip__dow', text: SHORT_DOW[i] }),
        Page.el('span', { className: 'week-strip__date', text: String(date.getDate()) }),
      );
      strip.append(day);
    }
    return strip;
  }

  async load() {
    try {
      const program = await api.get('/api/programs/current');
      this.program = program;
      this.renderDays();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        this.renderNoProgram();
        return;
      }
      this.handleError(err);
    }
  }

  renderDays() {
    if (!this.daysSlot || !this.program) return;
    this.daysSlot.replaceChildren();

    const days = Array.isArray(this.program.days) ? this.program.days : [];
    if (days.length === 0) {
      this.renderNoProgram();
      return;
    }

    const sorted = [...days].sort((a, b) => {
      const ai = DAYS_ORDER.indexOf((a.day ?? '').toLowerCase());
      const bi = DAYS_ORDER.indexOf((b.day ?? '').toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    for (const day of sorted) {
      const btn = Page.el('button', {
        className: `program-day${day.isRest ? ' program-day--rest' : ''}`,
      });
      btn.type = 'button';

      const left = Page.el('div', { className: 'program-day__col-left' });
      const dowIdx = DAYS_ORDER.indexOf((day.day ?? '').toLowerCase());
      left.append(
        Page.el('span', {
          className: 'program-day__dow',
          text: dowIdx >= 0 ? SHORT_DOW[dowIdx] : day.day ?? '',
        }),
        Page.el('span', {
          className: 'program-day__date',
          text: day.isRest ? '—' : String((day.exercises ?? []).length),
        }),
      );

      const divider = Page.el('div', { className: 'program-day__divider' });

      const right = Page.el('div', { className: 'program-day__col-right' });
      const exerciseNames = (day.exercises ?? [])
        .map((e) => (e.exercise?.name ?? '').trim())
        .filter(Boolean);
      right.append(
        Page.el('span', {
          className: 'program-day__name',
          text: day.isRest
            ? i18n.t('program.rest_day')
            : exerciseNames.slice(0, 2).join(' + ') || i18n.t('program.title'),
        }),
        Page.el('span', {
          className: 'program-day__exercises',
          text: day.isRest
            ? ''
            : exerciseNames.length > 2
              ? `${exerciseNames.slice(0, 3).join(' · ')} +${exerciseNames.length - 3}`
              : exerciseNames.join(' · '),
        }),
      );

      btn.append(left, divider, right);

      if (!day.isRest) {
        this.on(btn, 'click', () => {
          haptics.tap();
          this.openDaySheet(day);
        });
      }

      this.daysSlot.append(btn);
    }
  }

  /** @param {any} day */
  openDaySheet(day) {
    const sheet = new BottomSheet(document.body, {
      title: `${(day.day ?? '').toUpperCase()} · ${(day.exercises ?? []).length} exercises`,
    });
    sheet.render();

    const list = Page.el('div', { className: 'log-set-list' });
    for (const ex of day.exercises ?? []) {
      const row = Page.el('div', { className: 'set-row' });
      row.innerHTML = `
        <span class="set-row__badge">${ex.sets ?? 3}</span>
        <span class="set-row__data">${escapeHtml(ex.exercise?.name ?? '')}</span>
      `;
      list.append(row);
    }
    sheet.setBody(list);
    sheet.open();
  }

  renderNoProgram() {
    if (!this.daysSlot) return;
    const host = Page.el('div');
    new EmptyState(host, {
      heading: i18n.t('program.no_program'),
    }).render();
    this.daysSlot.replaceChildren(host);
  }

  /** @param {unknown} err */
  handleError(err) {
    if (err instanceof NetworkError) {
      toast.show('Network error.', { variant: 'error' });
      return;
    }
    if (err instanceof ApiError) {
      toast.show(err.message, { variant: 'error' });
      return;
    }
    toast.show(i18n.t('common.error'), { variant: 'error' });
  }
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
