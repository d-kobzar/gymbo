import { Page } from './page.base.js';
import { BottomSheet } from '../components/bottom-sheet.js';
import { Skeleton } from '../components/skeleton.js';
import { EmptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';

/**
 * Exercises page — catalogue of the user's exercise library, sorted
 * alphabetically and bucketed by first letter. Search filter on top;
 * floating action button bottom-right to add a new one; tap an item
 * to edit/delete in a bottom sheet.
 */
export class ExercisesPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {Array<{id:number,name:string}>} */
    this.items = [];
    this.filter = '';
    /** @type {HTMLInputElement | null} */
    this.searchEl = null;
    /** @type {HTMLElement | null} */
    this.listSlot = null;
  }

  render() {
    const shell = Page.el('div', { className: 'page-shell' });
    shell.append(this.renderHeader());
    shell.append(this.renderSearch());

    this.listSlot = Page.el('div', { className: 'page-section' });
    const sk = Page.el('div');
    new Skeleton(sk, { variant: 'card', height: '58px' }).render();
    this.listSlot.append(sk);
    shell.append(this.listSlot);

    this.root.append(shell);
    this.root.append(this.renderFab());

    void this.load();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('exercises.title'),
      }),
      Page.el('span', {
        className: 'page-header__kicker',
        text: i18n.t('exercises.subtitle'),
      }),
    );
    return header;
  }

  renderSearch() {
    const wrap = Page.el('div', { className: 'exercises-search' });
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'search';
    input.placeholder = 'Search…';
    input.autocomplete = 'off';
    this.searchEl = input;
    this.on(input, 'input', () => {
      this.filter = input.value.trim().toLowerCase();
      this.renderList();
    });
    wrap.append(input);
    return wrap;
  }

  renderFab() {
    const fab = Page.el('button', { className: 'fab' });
    fab.type = 'button';
    fab.setAttribute('aria-label', i18n.t('exercises.add'));
    fab.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    `;
    this.on(fab, 'click', () => {
      haptics.tap();
      this.openEditSheet(null);
    });
    return fab;
  }

  async load() {
    try {
      const items = await api.get('/api/exercises');
      this.items = /** @type {Array<{id:number,name:string}>} */ (items ?? []);
      this.renderList();
    } catch (err) {
      this.handleError(err);
    }
  }

  renderList() {
    if (!this.listSlot) return;
    const filtered = this.items
      .filter((e) => (this.filter ? e.name.toLowerCase().includes(this.filter) : true))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
      const host = Page.el('div');
      new EmptyState(host, {
        heading: i18n.t('common.no_data'),
        description: this.filter
          ? 'Try a different search term.'
          : 'Tap + to add your first exercise.',
      }).render();
      this.listSlot.replaceChildren(host);
      return;
    }

    /** @type {Map<string, Array<{id:number,name:string}>>} */
    const groups = new Map();
    for (const ex of filtered) {
      const letter = (ex.name[0] ?? '?').toUpperCase();
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)?.push(ex);
    }

    this.listSlot.replaceChildren();
    for (const [letter, exs] of groups) {
      const group = Page.el('section', { className: 'exercises-group' });
      group.append(Page.el('span', { className: 'exercises-group__letter', text: letter }));
      for (const ex of exs) {
        const row = Page.el('button', { className: 'exercise-item' });
        row.type = 'button';
        row.innerHTML = `
          <span class="exercise-item__avatar">${escapeHtml(ex.name[0] ?? '?').toUpperCase()}</span>
          <span class="exercise-item__name">${escapeHtml(ex.name)}</span>
          <span class="exercise-item__chevron" aria-hidden="true">
            <svg width="12" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
        `;
        this.on(row, 'click', () => {
          haptics.tap();
          this.openEditSheet(ex);
        });
        group.append(row);
      }
      this.listSlot.append(group);
    }
  }

  /** @param {{id:number,name:string} | null} ex */
  openEditSheet(ex) {
    const sheet = new BottomSheet(document.body, {
      title: ex ? i18n.t('common.edit') : i18n.t('exercises.add'),
    });
    sheet.render();

    const form = Page.el('form', { className: 'measure-form' });
    const group = Page.el('div', { className: 'input-group' });
    group.append(
      Page.el('label', { className: 'input-label', text: i18n.t('exercises.name_placeholder') }),
    );
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.required = true;
    input.value = ex?.name ?? '';
    group.append(input);
    form.append(group);

    const actions = Page.el('div', { className: 'grid-2' });
    const save = Page.el('button', {
      className: 'button button--primary button--lg button--block',
      text: i18n.t('common.save'),
    });
    save.type = 'submit';
    actions.append(save);
    if (ex) {
      const del = Page.el('button', {
        className: 'button button--danger button--lg button--block',
        text: i18n.t('common.delete'),
      });
      del.type = 'button';
      this.on(del, 'click', () => {
        void this.remove(ex, sheet);
      });
      actions.append(del);
    }
    form.append(actions);

    this.on(form, 'submit', async (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      try {
        if (ex) await api.put(`/api/exercises/${ex.id}`, { name });
        else await api.post('/api/exercises', { name });
        haptics.success();
        toast.show(ex ? i18n.t('exercises.updated') : i18n.t('exercises.added'), {
          variant: 'success',
        });
        sheet.close();
        await this.load();
      } catch (err) {
        this.handleError(err);
      }
    });

    sheet.setBody(form);
    sheet.open();
    input.focus();
  }

  /** @param {{id:number,name:string}} ex @param {BottomSheet} sheet */
  async remove(ex, sheet) {
    try {
      await api.del(`/api/exercises/${ex.id}`);
      haptics.success();
      toast.show(i18n.t('exercises.deleted'), { variant: 'success' });
      sheet.close();
      await this.load();
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

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
