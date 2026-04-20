import { Page } from './page.base.js';
import { ExercisePicker } from '../components/exercise-picker.js';
import { Skeleton } from '../components/skeleton.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SHORT_DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DEFAULT_SETS = 3;
const MAX_SETS = 20;

const TRASH_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
`;

/**
 * Program editor — always creates a new version via POST
 * /api/programs. Starting point: the user's latest program if one
 * exists (so "edit" means "fork + tweak"), otherwise a blank 7-day
 * template with every day marked as rest.
 *
 * There is no PUT on the backend by design: programs are versioned,
 * and "edit" means "new version".
 */
export class ProgramEditorPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    this.name = '';
    /**
     * @type {Array<{
     *   day: string,
     *   isRest: boolean,
     *   exercises: Array<{ exerciseId: number | null, exerciseName: string, sets: number }>
     * }>}
     */
    this.days = DAYS_ORDER.map((day) => ({ day, isRest: true, exercises: [] }));
    /** @type {Array<{id: number, name: string}>} */
    this.exerciseCatalog = [];
    /** @type {HTMLInputElement | null} */
    this.nameInput = null;
    /** @type {HTMLElement | null} */
    this.daysSlot = null;
  }

  render() {
    const shell = Page.el('div', { className: 'page-shell' });
    shell.append(this.renderHeader());

    const form = Page.el('form', { className: 'program-editor' });
    form.append(this.renderNameField());

    this.daysSlot = Page.el('div', { className: 'program-editor' });
    const skeleton = Page.el('div');
    new Skeleton(skeleton, { variant: 'card', height: '400px' }).render();
    this.daysSlot.append(skeleton);
    form.append(this.daysSlot);

    form.append(this.renderActions());

    this.on(form, 'submit', this.handleSubmit);

    shell.append(form);
    this.root.append(shell);

    void this.loadAll();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('program.new_version'),
      }),
      Page.el('span', {
        className: 'page-header__kicker',
        text: i18n.t('program.subtitle'),
      }),
    );
    return header;
  }

  renderNameField() {
    const wrap = Page.el('div', { className: 'input-group' });
    wrap.append(
      Page.el('label', {
        className: 'input-label',
        text: i18n.t('program.title'),
      }),
    );
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'text';
    input.placeholder = 'e.g. PPL v2';
    input.autocomplete = 'off';
    input.required = true;
    this.on(input, 'input', () => {
      this.name = input.value;
    });
    this.nameInput = input;
    wrap.append(input);
    return wrap;
  }

  renderActions() {
    const actions = Page.el('div', { className: 'program-editor__actions' });
    const save = Page.el('button', {
      className: 'button button--primary button--lg button--block',
      text: i18n.t('common.save'),
    });
    save.type = 'submit';
    const cancel = Page.el('button', {
      className: 'button button--ghost button--lg button--block',
      text: i18n.t('common.cancel'),
    });
    cancel.type = 'button';
    this.on(cancel, 'click', () => {
      haptics.tap();
      globalThis.location.hash = '/program';
    });
    actions.append(save, cancel);
    return actions;
  }

  async loadAll() {
    try {
      const [exercises, current] = await Promise.all([
        api.get('/api/exercises'),
        api.get('/api/programs/current').catch((err) => {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
      ]);
      this.exerciseCatalog = /** @type {Array<{id:number,name:string}>} */ (
        exercises ?? []
      );
      if (current) {
        this.hydrateFromProgram(/** @type {any} */ (current));
      }
      this.renderDays();
    } catch (err) {
      this.handleError(err);
    }
  }

  /** @param {any} program */
  hydrateFromProgram(program) {
    const baseName = program.name ? `${program.name} v${(program.version ?? 0) + 1}` : '';
    if (this.nameInput) this.nameInput.value = baseName;
    this.name = baseName;

    const byDay = new Map(
      (program.days ?? []).map((d) => [(d.day ?? '').toLowerCase(), d]),
    );
    this.days = DAYS_ORDER.map((day) => {
      const src = byDay.get(day);
      if (!src) return { day, isRest: true, exercises: [] };
      return {
        day,
        isRest: Boolean(src.isRest),
        exercises: (src.exercises ?? []).map((e) => ({
          exerciseId: e.exerciseId ?? e.exercise?.id ?? null,
          exerciseName: e.exercise?.name ?? '',
          sets: Number(e.sets ?? DEFAULT_SETS),
        })),
      };
    });
  }

  renderDays() {
    if (!this.daysSlot) return;
    this.daysSlot.replaceChildren();
    this.days.forEach((day, idx) => {
      this.daysSlot?.append(this.renderDayCard(day, idx));
    });
  }

  /**
   * @param {{day:string,isRest:boolean,exercises:Array<any>}} day
   * @param {number} idx
   */
  renderDayCard(day, idx) {
    const card = Page.el('section', {
      className: `program-editor__day${day.isRest ? ' program-editor__day--rest' : ''}`,
    });

    const head = Page.el('div', { className: 'program-editor__day-head' });
    head.append(
      Page.el('span', { className: 'program-editor__day-title', text: SHORT_DOW[idx] }),
    );

    const toggleWrap = Page.el('label', { className: 'program-editor__day-toggle' });
    toggleWrap.append(
      Page.el('span', { text: i18n.t('program.rest_day') }),
      this.toggle(day.isRest, (on) => {
        day.isRest = on;
        if (on) day.exercises = [];
        this.renderDays();
      }),
    );
    head.append(toggleWrap);
    card.append(head);

    if (!day.isRest) {
      for (const ex of day.exercises) {
        card.append(this.renderExerciseRow(day, ex));
      }
      const addBtn = Page.el('button', {
        className: 'program-editor__add-exercise',
        text: `+ ${i18n.t('exercises.add')}`,
      });
      addBtn.type = 'button';
      this.on(addBtn, 'click', () => {
        haptics.tap();
        day.exercises.push({ exerciseId: null, exerciseName: '', sets: DEFAULT_SETS });
        this.renderDays();
        // Immediately open the picker for the new row.
        this.openPicker(day, day.exercises[day.exercises.length - 1]);
      });
      card.append(addBtn);
    }

    return card;
  }

  /**
   * @param {any} day
   * @param {{exerciseId:number|null,exerciseName:string,sets:number}} ex
   */
  renderExerciseRow(day, ex) {
    const row = Page.el('div', { className: 'program-editor__exercise' });

    const picker = Page.el('button', {
      className: `program-editor__exercise-name${ex.exerciseId ? '' : ' program-editor__exercise-name--empty'}`,
      text: ex.exerciseName || i18n.t('workout.select_exercise'),
    });
    picker.type = 'button';
    this.on(picker, 'click', () => {
      haptics.tap();
      this.openPicker(day, ex);
    });

    const sets = document.createElement('input');
    sets.className = 'program-editor__sets';
    sets.type = 'number';
    sets.inputMode = 'numeric';
    sets.min = '1';
    sets.max = String(MAX_SETS);
    sets.step = '1';
    sets.value = String(ex.sets ?? DEFAULT_SETS);
    this.on(sets, 'input', () => {
      const n = Number(sets.value);
      ex.sets = Number.isFinite(n) && n >= 1 && n <= MAX_SETS ? n : DEFAULT_SETS;
    });

    const remove = Page.el('button', {
      className: 'program-editor__remove',
      html: TRASH_ICON,
    });
    remove.type = 'button';
    remove.setAttribute('aria-label', i18n.t('common.delete'));
    this.on(remove, 'click', () => {
      haptics.warning();
      day.exercises = day.exercises.filter((e) => e !== ex);
      this.renderDays();
    });

    row.append(picker, sets, remove);
    return row;
  }

  /**
   * @param {any} day
   * @param {{exerciseId:number|null,exerciseName:string,sets:number}} ex
   */
  openPicker(day, ex) {
    new ExercisePicker(document.body, {
      title: i18n.t('workout.select_exercise'),
      items: this.exerciseCatalog,
      onSelect: (id) => {
        const picked = this.exerciseCatalog.find((e) => e.id === id);
        if (!picked) return;
        ex.exerciseId = picked.id;
        ex.exerciseName = picked.name;
        this.renderDays();
      },
    }).open();
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
      haptics.select();
      onChange(next);
    });
    return btn;
  }

  handleSubmit = async (event) => {
    event.preventDefault();
    const name = (this.nameInput?.value ?? '').trim();
    if (!name) {
      toast.show('Program needs a name', { variant: 'warning' });
      return;
    }
    const payload = {
      name,
      days: this.days.map((day) => ({
        day: day.day,
        isRest: day.isRest,
        exercises: day.isRest
          ? []
          : day.exercises
              .filter((ex) => ex.exerciseId != null)
              .map((ex) => ({ exerciseId: ex.exerciseId, sets: ex.sets })),
      })),
    };

    try {
      await api.post('/api/programs', payload);
      haptics.success();
      toast.show('Program saved', { variant: 'success' });
      globalThis.location.hash = '/program';
    } catch (err) {
      this.handleError(err);
    }
  };

  /** @param {unknown} err */
  handleError(err) {
    if (err instanceof NetworkError) toast.show('Network error.', { variant: 'error' });
    else if (err instanceof ApiError) toast.show(err.message, { variant: 'error' });
    else toast.show(i18n.t('common.error'), { variant: 'error' });
  }
}
