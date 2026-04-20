import { Page } from './page.base.js';
import { Skeleton } from '../components/skeleton.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';

const LANGS = ['en', 'ua', 'ru'];
const THEME_KEY = 'gymbo_theme';

/**
 * Settings page — language, notification toggles, TG-theme opt-in,
 * data export/import. Writes to /api/notifications for reminder
 * state; stores theme preference in localStorage so the boot step
 * can apply it before the first paint.
 */
export class SettingsPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {any | null} */
    this.notif = null;
    /** @type {HTMLElement | null} */
    this.notifSlot = null;
  }

  render() {
    const shell = Page.el('div', { className: 'page-shell' });
    shell.append(this.renderHeader());
    shell.append(this.renderLanguage());

    this.notifSlot = Page.el('div');
    const sk = Page.el('div');
    new Skeleton(sk, { variant: 'card', height: '200px' }).render();
    this.notifSlot.append(sk);
    shell.append(this.notifSlot);

    shell.append(this.renderTheme());
    shell.append(this.renderData());

    this.root.append(shell);
    void this.loadNotifications();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('settings.title'),
      }),
    );
    return header;
  }

  renderLanguage() {
    const section = Page.section(i18n.t('settings.language'));
    const wrap = Page.el('div', { className: 'settings-language' });
    for (const code of LANGS) {
      const btn = Page.el('button', {
        className: `settings-language__btn${i18n.lang === code ? ' settings-language__btn--active' : ''}`,
        text: code.toUpperCase(),
      });
      btn.type = 'button';
      this.on(btn, 'click', () => {
        haptics.select();
        i18n.setLang(code);
        toast.show(i18n.t('settings.saved'), { variant: 'success' });
        this.rerender();
      });
      wrap.append(btn);
    }
    section.append(wrap);
    return section;
  }

  renderTheme() {
    const section = Page.section(i18n.t('settings.theme'));
    const group = Page.el('div', { className: 'settings-group' });
    const row = Page.el('div', { className: 'settings-row' });
    row.append(Page.el('span', { className: 'settings-row__label', text: i18n.t('settings.use_telegram_theme') }));
    const current = globalThis.localStorage?.getItem(THEME_KEY) === 'tg';
    row.append(this.toggle(current, (on) => {
      if (on) {
        globalThis.localStorage?.setItem(THEME_KEY, 'tg');
        document.documentElement.setAttribute('data-theme', 'tg');
      } else {
        globalThis.localStorage?.removeItem(THEME_KEY);
        document.documentElement.removeAttribute('data-theme');
      }
      haptics.select();
      toast.show(i18n.t('settings.saved'), { variant: 'success' });
    }));
    group.append(row);
    section.append(group);
    return section;
  }

  async loadNotifications() {
    try {
      this.notif = await api.get('/api/notifications');
      this.renderNotifications();
    } catch (err) {
      this.handleError(err);
    }
  }

  renderNotifications() {
    if (!this.notifSlot || !this.notif) return;
    const section = Page.section(i18n.t('settings.notifications'));
    const group = Page.el('div', { className: 'settings-group' });

    group.append(
      this.toggleRow(
        i18n.t('settings.training_reminder'),
        Boolean(this.notif.trainingReminder),
        (on) => this.saveNotif({ trainingReminder: on }),
        this.timeInput(this.notif.trainingTime ?? '18:00', (v) =>
          this.saveNotif({ trainingTime: v }),
        ),
      ),
      this.toggleRow(
        i18n.t('settings.measurement_reminder'),
        Boolean(this.notif.measurementReminder),
        (on) => this.saveNotif({ measurementReminder: on }),
        this.timeInput(this.notif.measurementTime ?? '09:00', (v) =>
          this.saveNotif({ measurementTime: v }),
        ),
      ),
      this.toggleRow(
        i18n.t('settings.weekly_summary'),
        Boolean(this.notif.weeklySummary),
        (on) => this.saveNotif({ weeklySummary: on }),
      ),
    );
    section.append(group);
    this.notifSlot.replaceChildren(section);
  }

  /**
   * @param {string} label
   * @param {boolean} value
   * @param {(on: boolean) => void} onToggle
   * @param {HTMLElement=} right
   */
  toggleRow(label, value, onToggle, right) {
    const row = Page.el('div', { className: 'settings-row' });
    row.append(Page.el('span', { className: 'settings-row__label', text: label }));
    const controls = Page.el('div');
    controls.style.display = 'flex';
    controls.style.gap = 'var(--space-3)';
    controls.style.alignItems = 'center';
    if (right) controls.append(right);
    controls.append(this.toggle(value, onToggle));
    row.append(controls);
    return row;
  }

  /**
   * @param {boolean} initial
   * @param {(on: boolean) => void} onChange
   */
  toggle(initial, onChange) {
    const btn = Page.el('button', {
      className: `settings-toggle${initial ? ' settings-toggle--on' : ''}`,
    });
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', initial ? 'true' : 'false');
    btn.innerHTML = '<span class="settings-toggle__dot"></span>';
    this.on(btn, 'click', () => {
      const next = !btn.classList.contains('settings-toggle--on');
      btn.classList.toggle('settings-toggle--on', next);
      btn.setAttribute('aria-checked', next ? 'true' : 'false');
      onChange(next);
    });
    return btn;
  }

  /**
   * @param {string} initial
   * @param {(v: string) => void} onChange
   */
  timeInput(initial, onChange) {
    const input = document.createElement('input');
    input.type = 'time';
    input.className = 'settings-time-input';
    input.value = initial;
    this.on(input, 'change', () => onChange(input.value));
    return input;
  }

  /** @param {Record<string, unknown>} patch */
  async saveNotif(patch) {
    try {
      this.notif = await api.put('/api/notifications', patch);
      haptics.success();
      toast.show(i18n.t('settings.saved'), { variant: 'success' });
    } catch (err) {
      this.handleError(err);
    }
  }

  renderData() {
    const section = Page.section(i18n.t('settings.data'));
    const group = Page.el('div', { className: 'settings-group' });

    const exportRow = Page.el('div', { className: 'settings-row' });
    exportRow.append(Page.el('span', { className: 'settings-row__label', text: i18n.t('dashboard.export_data') }));
    const exportBtn = Page.el('button', {
      className: 'button button--secondary button--sm',
      text: 'JSON',
    });
    exportBtn.type = 'button';
    this.on(exportBtn, 'click', () => {
      haptics.tap();
      void this.exportJson();
    });
    exportRow.append(exportBtn);
    group.append(exportRow);

    const importRow = Page.el('div', { className: 'settings-row' });
    importRow.append(Page.el('span', { className: 'settings-row__label', text: i18n.t('dashboard.import_data') }));
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json';
    importInput.style.display = 'none';
    const importBtn = Page.el('button', {
      className: 'button button--secondary button--sm',
      text: 'JSON',
    });
    importBtn.type = 'button';
    this.on(importBtn, 'click', () => {
      haptics.tap();
      importInput.click();
    });
    this.on(importInput, 'change', () => {
      const file = importInput.files?.[0];
      if (file) void this.importJson(file);
    });
    importRow.append(importBtn, importInput);
    group.append(importRow);

    section.append(group);
    return section;
  }

  async exportJson() {
    try {
      const data = await api.get('/api/backup/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gymbo-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      haptics.success();
      toast.show('Export downloaded', { variant: 'success' });
    } catch (err) {
      this.handleError(err);
    }
  }

  /** @param {File} file */
  async importJson(file) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await api.post('/api/backup/import', json);
      haptics.success();
      toast.show('Import complete', { variant: 'success' });
    } catch (err) {
      this.handleError(err);
    }
  }

  rerender() {
    this.root.replaceChildren();
    this.render();
  }

  /** @param {unknown} err */
  handleError(err) {
    if (err instanceof NetworkError) toast.show('Network error.', { variant: 'error' });
    else if (err instanceof ApiError) toast.show(err.message, { variant: 'error' });
    else toast.show(i18n.t('common.error'), { variant: 'error' });
  }
}
