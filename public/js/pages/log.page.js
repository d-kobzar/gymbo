import { Page } from './page.base.js';
import { ExercisePicker } from '../components/exercise-picker.js';
import { SetRow } from '../components/set-row.js';
import { Skeleton } from '../components/skeleton.js';
import { EmptyState } from '../components/empty-state.js';
import { SegmentedControl } from '../components/segmented-control.js';
import { RestTimer } from '../components/rest-timer.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';
import { telegram } from '../core/telegram.js';

const DRAFT_KEY = 'gymbo_log_draft';
const REST_DURATION_KEY = 'gymbo_rest_duration';
const REST_PRESETS = [60, 90, 120, 180];
const REST_DEFAULT = 90;

/**
 * Log page — capture one set at a time.
 *
 * Layout:
 *   - date row (today by default)
 *   - exercise picker (tap → BottomSheet)
 *   - 3-column input grid: reps / weight / RIR (numeric keyboards)
 *   - Telegram MainButton "Add Set" (falls back to an in-page
 *     button when the SDK is unavailable)
 *   - today's sets grouped by exercise (SetRow with swipe-to-delete)
 *
 * Draft persistence: every input change writes to localStorage;
 * restored on mount, cleared on successful submit.
 *
 * Optimistic writes: a freshly-logged set appears immediately;
 * removed with an error toast if the POST fails.
 */
export class LogPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {Array<{id: number, name: string}>} */
    this.exercises = [];
    /** @type {Array<any>} */
    this.todaySets = [];
    /** @type {number | null} */
    this.selectedExerciseId = null;
    /** @type {string | null} */
    this.selectedExerciseName = null;
    /** @type {HTMLInputElement | null} */
    this.repsInput = null;
    /** @type {HTMLInputElement | null} */
    this.weightInput = null;
    /** @type {HTMLInputElement | null} */
    this.rirInput = null;
    /** @type {HTMLElement | null} */
    this.selectBtn = null;
    /** @type {HTMLElement | null} */
    this.lastSessionEl = null;
    /** @type {HTMLElement | null} */
    this.todayHost = null;
    this.date = todayIso();
    this.restDuration = restoreRestDuration();
  }

  render() {
    const shell = Page.el('div', { className: 'page-shell' });

    shell.append(this.renderHeader());
    shell.append(this.renderDateRow());
    shell.append(this.renderExerciseSelector());
    shell.append(this.renderInputs());
    shell.append(this.renderRestSection());
    shell.append(this.renderTodaySection());

    this.root.append(shell);

    this.restoreDraft();
    this.applyInitialExercise();
    void this.load();
    // Defensively hide MainButton in case another page left it up.
    telegram.mainButton.hide();
  }

  destroy() {
    telegram.mainButton.hide();
    super.destroy();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('span', {
        className: 'page-header__kicker',
        text: i18n.t('workout.new_set'),
      }),
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('workout.page_title'),
      }),
    );
    return header;
  }

  renderDateRow() {
    const row = Page.el('div', { className: 'log-date-row' });
    row.innerHTML = `
      <span>${escapeHtml(i18n.t('workout.date'))}</span>
      <span class="log-date-row__date">${escapeHtml(this.date)}</span>
    `;
    return row;
  }

  renderExerciseSelector() {
    const wrap = Page.el('div', { className: 'page-section' });
    const btn = Page.el('button', { className: 'log-exercise-select' });
    btn.type = 'button';
    btn.innerHTML = `
      <span class="log-exercise-select__placeholder" data-role="name">
        ${escapeHtml(i18n.t('workout.select_exercise'))}
      </span>
      <span class="log-exercise-select__chevron" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>
    `;
    this.on(btn, 'click', () => {
      haptics.tap();
      this.openExercisePicker();
    });
    this.selectBtn = btn;
    wrap.append(btn);

    this.lastSessionEl = Page.el('span', { className: 'log-last-session' });
    wrap.append(this.lastSessionEl);
    return wrap;
  }

  renderInputs() {
    const wrap = Page.el('div', { className: 'page-section' });

    const grid = Page.el('div', { className: 'log-input-grid' });
    grid.append(
      this.numericInput('reps', i18n.t('workout.reps'), { min: 0, max: 1000 }),
      this.numericInput('weight', i18n.t('workout.weight'), {
        min: 0,
        max: 1000,
        step: 0.5,
      }),
      this.numericInput('rir', i18n.t('workout.rir'), { min: 0, max: 10 }),
    );
    wrap.append(grid);

    // In-page "Add Set" button — amber on dark per the V2 design.
    // We intentionally do NOT use Telegram's MainButton: its system
    // color (blue on dark) breaks the design, and users reported
    // seeing it under the menu with no way to recolor.
    const addBtn = Page.el('button', {
      className: 'button button--primary button--lg button--block',
      text: i18n.t('workout.add_set'),
    });
    addBtn.type = 'button';
    this.on(addBtn, 'click', this.submit);
    wrap.append(addBtn);

    return wrap;
  }

  /**
   * @param {'reps'|'weight'|'rir'} name
   * @param {string} label
   * @param {{ min?: number, max?: number, step?: number }} attrs
   */
  numericInput(name, label, attrs = {}) {
    const group = Page.el('div', { className: 'input-group' });
    group.append(Page.el('label', { className: 'input-label', text: label }));
    const input = document.createElement('input');
    input.className = 'input input--numeric';
    input.type = 'number';
    input.inputMode = 'decimal';
    input.name = name;
    if (attrs.min != null) input.min = String(attrs.min);
    if (attrs.max != null) input.max = String(attrs.max);
    input.step = attrs.step != null ? String(attrs.step) : '1';
    this.on(input, 'input', () => this.saveDraft());
    this.on(input, 'keydown', (event) => {
      const ev = /** @type {KeyboardEvent} */ (event);
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.advanceFocus(name);
      }
    });
    group.append(input);
    if (name === 'reps') this.repsInput = input;
    else if (name === 'weight') this.weightInput = input;
    else this.rirInput = input;
    return group;
  }

  renderRestSection() {
    const section = Page.el('div', { className: 'page-section log-rest' });
    section.append(
      Page.el('span', { className: 'input-label', text: i18n.t('rest.duration') }),
    );

    const seg = Page.el('div');
    new SegmentedControl(seg, {
      block: true,
      value: String(this.restDuration),
      options: REST_PRESETS.map((s) => ({ id: String(s), label: formatMmSs(s) })),
      onChange: (id) => {
        this.restDuration = Number(id);
        saveRestDuration(this.restDuration);
      },
    }).render();
    section.append(seg);

    const startBtn = Page.el('button', {
      className: 'button button--ghost button--block',
      text: i18n.t('rest.start'),
    });
    startBtn.type = 'button';
    this.on(startBtn, 'click', () => {
      haptics.tap();
      this.openRestTimer();
    });
    section.append(startBtn);

    return section;
  }

  /** @param {string=} nextSetLabel */
  openRestTimer(nextSetLabel) {
    new RestTimer(document.body, {
      seconds: this.restDuration,
      nextSetLabel,
    }).open();
  }

  renderTodaySection() {
    const section = Page.section(i18n.t('workout.workout_log'));
    this.todayHost = Page.el('div', { className: 'log-set-list' });
    const skeleton = Page.el('div');
    new Skeleton(skeleton, { variant: 'card', height: '52px' }).render();
    this.todayHost.append(skeleton);
    section.append(this.todayHost);
    return section;
  }

  async load() {
    try {
      const [exercises, logs] = await Promise.all([
        api.get('/api/exercises'),
        api.get(`/api/training-logs?date=${this.date}&limit=100`),
      ]);
      this.exercises = /** @type {Array<{id:number,name:string}>} */ (exercises ?? []);
      const paged = /** @type {{ data: Array<any> }} */ (logs);
      this.todaySets = Array.isArray(paged?.data) ? paged.data : [];
      this.renderTodaySets();
      this.refreshLastSession();
    } catch (err) {
      this.handleLoadError(err);
    }
  }

  renderTodaySets() {
    if (!this.todayHost) return;
    this.todayHost.replaceChildren();

    if (this.todaySets.length === 0) {
      const host = Page.el('div');
      new EmptyState(host, {
        heading: i18n.t('common.no_data'),
      }).render();
      this.todayHost.append(host);
      return;
    }

    const byExercise = new Map();
    for (const set of this.todaySets) {
      const name = set.exercise?.name ?? '—';
      if (!byExercise.has(name)) byExercise.set(name, []);
      byExercise.get(name).push(set);
    }

    for (const [name, sets] of byExercise) {
      const group = Page.el('div', { className: 'log-exercise-group' });
      group.append(Page.el('h3', { className: 'log-exercise-group__title', text: name }));
      const counter = Page.el('span', {
        className: 'log-counter',
        text: `${sets.length} ${i18n.t('program.sets')}`,
      });
      group.append(counter);
      for (const set of sets) {
        const slot = Page.el('div');
        new SetRow(slot, {
          setNumber: set.setNumber,
          reps: set.reps,
          weight: Number(set.weight),
          rir: set.rir,
          isDone: true,
          onDelete: () => void this.deleteSet(set),
        }).render();
        group.append(slot);
      }
      this.todayHost.append(group);
    }
  }

  /** @param {any} set */
  async deleteSet(set) {
    const prev = this.todaySets;
    this.todaySets = this.todaySets.filter((s) => s.id !== set.id);
    this.renderTodaySets();
    try {
      await api.del(`/api/training-logs/${set.id}`);
      haptics.success();
      toast.show(i18n.t('toasts.set_deleted'), { variant: 'success' });
    } catch (err) {
      this.todaySets = prev;
      this.renderTodaySets();
      this.handleLoadError(err);
    }
  }

  openExercisePicker() {
    const picker = new ExercisePicker(document.body, {
      title: i18n.t('workout.select_exercise'),
      items: this.exercises.map((e) => ({ id: e.id, name: e.name })),
      onSelect: (id) => {
        const exercise = this.exercises.find((e) => e.id === id);
        if (!exercise) return;
        this.selectedExerciseId = exercise.id;
        this.selectedExerciseName = exercise.name;
        this.updateExerciseButton();
        this.refreshLastSession();
        this.saveDraft();
        this.repsInput?.focus();
      },
    });
    picker.open();
  }

  updateExerciseButton() {
    if (!this.selectBtn) return;
    const nameEl = /** @type {HTMLElement | null} */ (
      this.selectBtn.querySelector('[data-role="name"]')
    );
    if (!nameEl) return;
    if (this.selectedExerciseName) {
      nameEl.textContent = this.selectedExerciseName;
      nameEl.classList.remove('log-exercise-select__placeholder');
    } else {
      nameEl.textContent = i18n.t('workout.select_exercise');
      nameEl.classList.add('log-exercise-select__placeholder');
    }
  }

  refreshLastSession() {
    if (!this.lastSessionEl) return;
    if (!this.selectedExerciseId) {
      this.lastSessionEl.textContent = '';
      return;
    }
    const forExercise = this.todaySets
      .concat([])
      .filter((s) => s.exerciseId === this.selectedExerciseId)
      .sort((a, b) => (b.setNumber ?? 0) - (a.setNumber ?? 0));
    const last = forExercise[0];
    if (!last) {
      this.lastSessionEl.textContent = '';
      return;
    }
    const rir = last.rir != null ? ` RIR ${last.rir}` : '';
    this.lastSessionEl.textContent = `Last: ${last.reps} × ${Number(last.weight)} kg${rir}`;
  }

  submit = async () => {
    const reps = Number(this.repsInput?.value);
    const weight = Number(this.weightInput?.value);
    const rirRaw = this.rirInput?.value?.trim() ?? '';
    const rir = rirRaw === '' ? undefined : Number(rirRaw);
    if (!this.selectedExerciseId || !Number.isFinite(reps) || reps <= 0 ||
        !Number.isFinite(weight) || weight <= 0) {
      haptics.error();
      toast.show(i18n.t('common.error'), { variant: 'error' });
      return;
    }

    const optimistic = {
      id: -Date.now(),
      date: this.date,
      exerciseId: this.selectedExerciseId,
      exercise: { id: this.selectedExerciseId, name: this.selectedExerciseName },
      setNumber: this.nextSetNumber(),
      reps,
      weight,
      rir,
    };
    this.todaySets = [...this.todaySets, optimistic];
    this.renderTodaySets();

    try {
      const result = await api.post('/api/training-logs', {
        date: this.date,
        exerciseId: this.selectedExerciseId,
        setNumber: optimistic.setNumber,
        reps,
        weight,
        rir,
      });
      const saved = /** @type {{ log: any, isPr: boolean }} */ (result);
      const saved_with_exercise = {
        ...saved.log,
        exercise: optimistic.exercise,
      };
      this.todaySets = this.todaySets
        .filter((s) => s.id !== optimistic.id)
        .concat([saved_with_exercise]);
      this.renderTodaySets();

      if (saved.isPr) {
        haptics.success();
        toast.show(i18n.t('toasts.pr_new'), { variant: 'success' });
      } else {
        haptics.success();
        toast.show(i18n.t('toasts.set_added'), { variant: 'success' });
      }
      this.resetInputs();
      this.clearDraft();
      this.refreshLastSession();

      const nextSetLabel = i18n.t('rest.next_set', {
        set: this.nextSetNumber(),
        reps,
        weight,
      });
      this.openRestTimer(nextSetLabel);
    } catch (err) {
      this.todaySets = this.todaySets.filter((s) => s.id !== optimistic.id);
      this.renderTodaySets();
      this.handleLoadError(err);
    }
  };

  nextSetNumber() {
    if (!this.selectedExerciseId) return 1;
    const same = this.todaySets.filter((s) => s.exerciseId === this.selectedExerciseId);
    const max = same.reduce((acc, s) => Math.max(acc, s.setNumber ?? 0), 0);
    return max + 1;
  }

  resetInputs() {
    if (this.repsInput) this.repsInput.value = '';
    if (this.weightInput) this.weightInput.value = '';
    if (this.rirInput) this.rirInput.value = '';
  }

  /** @param {'reps'|'weight'|'rir'} current */
  advanceFocus(current) {
    if (current === 'reps') this.weightInput?.focus();
    else if (current === 'weight') this.rirInput?.focus();
    else this.submit();
  }

  saveDraft() {
    const draft = {
      date: this.date,
      exerciseId: this.selectedExerciseId,
      exerciseName: this.selectedExerciseName,
      reps: this.repsInput?.value ?? '',
      weight: this.weightInput?.value ?? '',
      rir: this.rirInput?.value ?? '',
    };
    try {
      globalThis.localStorage?.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // storage quota / private mode — safe to ignore
    }
  }

  clearDraft() {
    try {
      globalThis.localStorage?.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  restoreDraft() {
    try {
      const raw = globalThis.localStorage?.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.date !== this.date) return;
      if (this.repsInput) this.repsInput.value = draft.reps ?? '';
      if (this.weightInput) this.weightInput.value = draft.weight ?? '';
      if (this.rirInput) this.rirInput.value = draft.rir ?? '';
      this.selectedExerciseId = draft.exerciseId ?? null;
      this.selectedExerciseName = draft.exerciseName ?? null;
      this.updateExerciseButton();
    } catch {
      /* ignore malformed draft */
    }
  }

  applyInitialExercise() {
    const params = /** @type {Record<string, string> | undefined} */ (this.props.params);
    const name = params?.exercise;
    if (!name) return;
    // We'll resolve the id once exercises load; in the meantime keep
    // the name so the button renders correctly.
    this.selectedExerciseName = name;
    this.updateExerciseButton();
    queueMicrotask(() => {
      const match = this.exercises.find((e) => e.name === name);
      if (match) {
        this.selectedExerciseId = match.id;
        this.refreshLastSession();
        this.saveDraft();
      }
    });
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
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** @returns {number} */
function restoreRestDuration() {
  try {
    const raw = globalThis.localStorage?.getItem(REST_DURATION_KEY);
    const n = Number(raw);
    if (REST_PRESETS.includes(n)) return n;
  } catch {
    /* ignore */
  }
  return REST_DEFAULT;
}

/** @param {number} seconds */
function saveRestDuration(seconds) {
  try {
    globalThis.localStorage?.setItem(REST_DURATION_KEY, String(seconds));
  } catch {
    /* ignore */
  }
}

/** @param {number} totalSeconds */
function formatMmSs(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
