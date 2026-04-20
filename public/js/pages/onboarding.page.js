import { Page } from './page.base.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { haptics } from '../core/haptics.js';
import { i18n } from '../core/i18n.js';

const DRAFT_KEY = 'gymbo_onboarding_draft';
const STEP_COUNT = 6;

const SEX_IDS = /** @type {const} */ (['male', 'female', 'other']);
const GOAL_IDS = /** @type {const} */ (['hypertrophy', 'strength', 'cut', 'maintenance']);
const LEVEL_IDS = /** @type {const} */ (['beginner', 'intermediate', 'advanced']);
const EQUIPMENT_IDS = /** @type {const} */ ([
  'barbell',
  'dumbbell',
  'machines',
  'cables',
  'bodyweight',
]);

/**
 * Onboarding quiz — 6 steps, required before the app unlocks.
 *
 *   1. Basics (sex, date of birth, height)
 *   2. Goal + experience + days/week
 *   3. Equipment (multi-select)
 *   4. Injuries + health notes
 *   5. First measurement (weight required, circumferences optional)
 *   6. Review → POST /api/users/onboarding
 *
 * Fully localized via i18n.t — labels and hints all pulled from the
 * `onboarding.*` namespace.
 */
export class OnboardingPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    this.stepIdx = 0;
    this.editMode = Boolean(props.editMode);
    this.draft = this.restoreDraft();
    /** @type {HTMLElement | null} */
    this.bodySlot = null;
    /** @type {HTMLElement | null} */
    this.actionsSlot = null;
    /** @type {HTMLElement | null} */
    this.progressSlot = null;
    /** @type {HTMLElement | null} */
    this.headerSlot = null;
  }

  render() {
    hideBottomNav();

    const shell = Page.el('div', { className: 'onboarding-shell' });

    this.progressSlot = Page.el('div', { className: 'onboarding-progress' });
    this.headerSlot = Page.el('div', { className: 'onboarding-header' });
    this.bodySlot = Page.el('div', { className: 'onboarding-body' });
    this.actionsSlot = Page.el('div', { className: 'onboarding-actions' });

    shell.append(this.progressSlot, this.headerSlot, this.bodySlot, this.actionsSlot);
    this.root.append(shell);

    this.renderStep();
  }

  destroy() {
    showBottomNav();
    super.destroy();
  }

  restoreDraft() {
    /** @type {any} */
    const base = {
      sex: null,
      dateOfBirth: '',
      heightCm: '',
      goal: null,
      experienceLevel: null,
      trainingDaysPerWeek: 4,
      equipment: [],
      injuries: [],
      injuryInput: '',
      healthNotes: '',
      weight: '',
      shoulders: '',
      arm: '',
      chest: '',
      waist: '',
      abs: '',
      glutes: '',
      thigh: '',
      calf: '',
    };
    const seed = /** @type {any} */ (this.props.seed ?? null);
    if (seed?.profile) {
      base.sex = seed.profile.sex ?? null;
      base.dateOfBirth = seed.profile.dateOfBirth ?? '';
      base.heightCm = seed.profile.heightCm ?? '';
      base.goal = seed.profile.goal ?? null;
      base.experienceLevel = seed.profile.experienceLevel ?? null;
      base.trainingDaysPerWeek = seed.profile.trainingDaysPerWeek ?? 4;
      base.equipment = Array.isArray(seed.profile.equipment)
        ? [...seed.profile.equipment]
        : [];
      base.injuries = Array.isArray(seed.profile.injuries)
        ? [...seed.profile.injuries]
        : [];
      base.healthNotes = seed.profile.healthNotes ?? '';
    }
    if (seed?.latestMeasurement) {
      for (const k of [
        'weight',
        'shoulders',
        'arm',
        'chest',
        'waist',
        'abs',
        'glutes',
        'thigh',
        'calf',
      ]) {
        const v = seed.latestMeasurement[k];
        if (v != null) base[k] = String(v);
      }
    }
    // In edit mode we intentionally skip the localStorage draft
    // — otherwise a stale onboarding draft would overwrite freshly
    // loaded profile data.
    if (!this.editMode) {
      try {
        const raw = globalThis.localStorage?.getItem(DRAFT_KEY);
        if (raw) Object.assign(base, JSON.parse(raw));
      } catch {
        /* ignore malformed draft */
      }
    }
    return base;
  }

  saveDraft() {
    try {
      globalThis.localStorage?.setItem(DRAFT_KEY, JSON.stringify(this.draft));
    } catch {
      /* storage quota */
    }
  }

  clearDraft() {
    try {
      globalThis.localStorage?.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  renderStep() {
    this.renderProgress();
    this.renderHeader();
    this.renderBody();
    this.renderActions();
  }

  renderProgress() {
    if (!this.progressSlot) return;
    this.progressSlot.replaceChildren();
    for (let i = 0; i < STEP_COUNT; i++) {
      const seg = Page.el('span', {
        className: `onboarding-progress__seg${
          i < this.stepIdx
            ? ' onboarding-progress__seg--done'
            : i === this.stepIdx
              ? ' onboarding-progress__seg--active'
              : ''
        }`,
      });
      this.progressSlot.append(seg);
    }
  }

  renderHeader() {
    if (!this.headerSlot) return;
    const meta = this.stepMeta();
    this.headerSlot.replaceChildren(
      Page.el('span', {
        className: 'onboarding-header__kicker',
        text: i18n.t('onboarding.step_of', {
          current: this.stepIdx + 1,
          total: STEP_COUNT,
        }),
      }),
      Page.el('h1', { className: 'onboarding-header__title', text: meta.title }),
      Page.el('p', { className: 'onboarding-header__hint', text: meta.hint }),
    );
  }

  renderBody() {
    if (!this.bodySlot) return;
    this.bodySlot.replaceChildren();
    switch (this.stepIdx) {
      case 0:
        this.bodySlot.append(this.renderBasicsStep());
        break;
      case 1:
        this.bodySlot.append(this.renderTrainingStep());
        break;
      case 2:
        this.bodySlot.append(this.renderEquipmentStep());
        break;
      case 3:
        this.bodySlot.append(this.renderHealthStep());
        break;
      case 4:
        this.bodySlot.append(this.renderMeasurementStep());
        break;
      case 5:
        this.bodySlot.append(this.renderSummaryStep());
        break;
      default:
        break;
    }
  }

  renderActions() {
    if (!this.actionsSlot) return;
    this.actionsSlot.replaceChildren();

    // In edit mode first-step "Back" returns to Settings; otherwise
    // pressing Back before step 1 is impossible (render skips it).
    if (this.stepIdx > 0 || this.editMode) {
      const back = Page.el('button', {
        className: 'button button--ghost button--lg',
        text: i18n.t(this.stepIdx === 0 ? 'common.cancel' : 'common.back'),
      });
      back.type = 'button';
      this.on(back, 'click', () => {
        haptics.tap();
        if (this.stepIdx === 0) {
          if (this.editMode) {
            globalThis.location.hash = '/settings';
          }
        } else {
          this.stepIdx -= 1;
          this.renderStep();
        }
      });
      this.actionsSlot.append(back);
    }

    const isLast = this.stepIdx === STEP_COUNT - 1;
    const next = Page.el('button', {
      className: 'button button--primary button--lg',
      text: isLast
        ? i18n.t(this.editMode ? 'common.save' : 'common.finish')
        : i18n.t('common.continue'),
    });
    next.type = 'button';
    this.on(next, 'click', () => {
      if (!this.canAdvance()) {
        haptics.error();
        toast.show(i18n.t('toasts.fill_required'), { variant: 'warning' });
        return;
      }
      haptics.tap();
      if (isLast) void this.submit();
      else {
        this.stepIdx += 1;
        this.renderStep();
      }
    });
    this.actionsSlot.append(next);
  }

  stepMeta() {
    const keys = [
      'basics',
      'training',
      'equipment',
      'health',
      'measurement',
      'review',
    ];
    const k = keys[this.stepIdx];
    return {
      title: i18n.t(`onboarding.step_${k}_title`),
      hint: i18n.t(`onboarding.step_${k}_hint`),
    };
  }

  canAdvance() {
    switch (this.stepIdx) {
      case 0:
        return (
          !!this.draft.sex &&
          !!this.draft.dateOfBirth &&
          Number.isFinite(Number(this.draft.heightCm)) &&
          Number(this.draft.heightCm) >= 80
        );
      case 1:
        return (
          !!this.draft.goal &&
          !!this.draft.experienceLevel &&
          Number.isInteger(Number(this.draft.trainingDaysPerWeek)) &&
          Number(this.draft.trainingDaysPerWeek) >= 1
        );
      case 2:
        return Array.isArray(this.draft.equipment) && this.draft.equipment.length > 0;
      case 3:
        return true;
      case 4:
        // First-time flow requires a weight; in edit mode the whole
        // measurement step is optional — users who don't want to
        // record a fresh measurement simply leave it empty.
        if (this.editMode) return true;
        return Number.isFinite(Number(this.draft.weight)) && Number(this.draft.weight) > 20;
      case 5:
        return true;
      default:
        return false;
    }
  }

  // ─ Step renderers ────────────────────────────────────────────

  renderBasicsStep() {
    const wrap = Page.el('div');
    wrap.append(
      this.labeledBlock(
        i18n.t('onboarding.sex'),
        this.optionGroup(
          SEX_IDS.map((id) => ({ id, label: i18n.t(`onboarding.sex_${id}`) })),
          this.draft.sex,
          (id) => {
            this.draft.sex = id;
            this.saveDraft();
            this.renderStep();
          },
        ),
      ),
      this.labeledBlock(
        i18n.t('onboarding.dob'),
        this.dateInput(this.draft.dateOfBirth, (v) => {
          this.draft.dateOfBirth = v;
          this.saveDraft();
        }),
      ),
      this.labeledBlock(
        i18n.t('onboarding.height_cm'),
        this.numberInput(this.draft.heightCm, { min: 80, max: 260 }, (v) => {
          this.draft.heightCm = v;
          this.saveDraft();
        }),
      ),
    );
    return wrap;
  }

  renderTrainingStep() {
    const wrap = Page.el('div');
    wrap.append(
      this.labeledBlock(
        i18n.t('onboarding.goal'),
        this.optionGroup(
          GOAL_IDS.map((id) => ({
            id,
            label: i18n.t(`onboarding.goal_${id}`),
            hint: i18n.t(`onboarding.goal_${id}_hint`),
          })),
          this.draft.goal,
          (id) => {
            this.draft.goal = id;
            this.saveDraft();
            this.renderStep();
          },
        ),
      ),
      this.labeledBlock(
        i18n.t('onboarding.experience'),
        this.optionGroup(
          LEVEL_IDS.map((id) => ({
            id,
            label: i18n.t(`onboarding.experience_${id}`),
            hint: i18n.t(`onboarding.experience_${id}_hint`),
          })),
          this.draft.experienceLevel,
          (id) => {
            this.draft.experienceLevel = id;
            this.saveDraft();
            this.renderStep();
          },
        ),
      ),
      this.labeledBlock(
        i18n.t('onboarding.days_per_week'),
        this.numberInput(this.draft.trainingDaysPerWeek, { min: 1, max: 7 }, (v) => {
          this.draft.trainingDaysPerWeek = v;
          this.saveDraft();
        }),
      ),
    );
    return wrap;
  }

  renderEquipmentStep() {
    const wrap = Page.el('div');
    const chips = Page.el('div', { className: 'onboarding-chips' });
    const equipment = /** @type {string[]} */ (this.draft.equipment ?? []);
    for (const id of EQUIPMENT_IDS) {
      const chip = Page.el('button', {
        className: `onboarding-chip${equipment.includes(id) ? ' onboarding-chip--active' : ''}`,
        text: i18n.t(`onboarding.equipment_${id}`),
      });
      chip.type = 'button';
      this.on(chip, 'click', () => {
        haptics.select();
        const next = equipment.includes(id)
          ? equipment.filter((e) => e !== id)
          : [...equipment, id];
        this.draft.equipment = next;
        this.saveDraft();
        this.renderStep();
      });
      chips.append(chip);
    }
    wrap.append(chips);
    return wrap;
  }

  renderHealthStep() {
    const wrap = Page.el('div');
    const injuries = /** @type {string[]} */ (this.draft.injuries ?? []);

    const chips = Page.el('div', { className: 'onboarding-chips' });
    for (const name of injuries) {
      const chip = Page.el('button', {
        className: 'onboarding-chip onboarding-chip--active',
        text: `${name} ✕`,
      });
      chip.type = 'button';
      this.on(chip, 'click', () => {
        haptics.warning();
        this.draft.injuries = injuries.filter((i) => i !== name);
        this.saveDraft();
        this.renderStep();
      });
      chips.append(chip);
    }

    const addRow = Page.el('div', { className: 'onboarding-injury-row' });
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'text';
    input.placeholder = i18n.t('onboarding.injuries_placeholder');
    input.value = this.draft.injuryInput ?? '';
    this.on(input, 'input', () => {
      this.draft.injuryInput = input.value;
      this.saveDraft();
    });
    const addBtn = Page.el('button', {
      className: 'button button--secondary button--lg',
      text: i18n.t('common.add'),
    });
    addBtn.type = 'button';
    this.on(addBtn, 'click', () => {
      const v = (input.value ?? '').trim();
      if (!v) return;
      if (injuries.includes(v)) return;
      this.draft.injuries = [...injuries, v];
      this.draft.injuryInput = '';
      this.saveDraft();
      this.renderStep();
    });
    addRow.append(input, addBtn);

    const textarea = document.createElement('textarea');
    textarea.className = 'onboarding-textarea';
    textarea.placeholder = i18n.t('onboarding.health_notes_placeholder');
    textarea.value = this.draft.healthNotes ?? '';
    this.on(textarea, 'input', () => {
      this.draft.healthNotes = textarea.value;
      this.saveDraft();
    });

    wrap.append(
      this.labeledBlock(i18n.t('onboarding.injuries'), chips, addRow),
      this.labeledBlock(i18n.t('onboarding.health_notes_optional'), textarea),
    );
    return wrap;
  }

  renderMeasurementStep() {
    const wrap = Page.el('div');
    const fields = [
      { id: 'weight', labelKey: 'weight_kg_required', required: true, step: 0.1 },
      { id: 'waist', labelKey: 'waist_cm' },
      { id: 'chest', labelKey: 'chest_cm' },
      { id: 'shoulders', labelKey: 'shoulders_cm' },
      { id: 'arm', labelKey: 'arm_cm' },
      { id: 'thigh', labelKey: 'thigh_cm' },
      { id: 'glutes', labelKey: 'glutes_cm' },
      { id: 'abs', labelKey: 'abs_cm' },
      { id: 'calf', labelKey: 'calf_cm' },
    ];
    const grid = Page.el('div', { className: 'onboarding-measurements' });
    for (const f of fields) {
      grid.append(
        this.labeledBlock(
          i18n.t(`onboarding.${f.labelKey}`),
          this.numberInput(
            this.draft[f.id],
            { min: 0, max: 400, step: f.step ?? 0.5 },
            (v) => {
              this.draft[f.id] = v;
              this.saveDraft();
            },
          ),
        ),
      );
    }
    wrap.append(grid);
    return wrap;
  }

  renderSummaryStep() {
    const wrap = Page.el('div', { className: 'onboarding-summary' });
    const rows = [
      [i18n.t('onboarding.review_sex'), this.draft.sex ? i18n.t(`onboarding.sex_${this.draft.sex}`) : ''],
      [i18n.t('onboarding.review_birthday'), this.draft.dateOfBirth],
      [i18n.t('onboarding.review_height'), `${this.draft.heightCm} cm`],
      [i18n.t('onboarding.review_goal'), this.draft.goal ? i18n.t(`onboarding.goal_${this.draft.goal}`) : ''],
      [i18n.t('onboarding.review_level'), this.draft.experienceLevel ? i18n.t(`onboarding.experience_${this.draft.experienceLevel}`) : ''],
      [i18n.t('onboarding.review_days'), this.draft.trainingDaysPerWeek],
      [
        i18n.t('onboarding.review_equipment'),
        (this.draft.equipment ?? [])
          .map((id) => i18n.t(`onboarding.equipment_${id}`))
          .join(', ') || i18n.t('common.none'),
      ],
      [
        i18n.t('onboarding.review_injuries'),
        (this.draft.injuries ?? []).join(', ') || i18n.t('common.none'),
      ],
      [i18n.t('onboarding.review_weight'), `${this.draft.weight} kg`],
    ];
    for (const [label, value] of rows) {
      const row = Page.el('div', { className: 'onboarding-summary__row' });
      row.append(
        Page.el('span', { className: 'onboarding-summary__label', text: String(label) }),
        Page.el('span', {
          className: 'onboarding-summary__value',
          text: value == null || value === '' ? '—' : String(value),
        }),
      );
      wrap.append(row);
    }
    return wrap;
  }

  // ─ Submit ────────────────────────────────────────────────────

  async submit() {
    const payload = this.buildPayload();
    try {
      if (this.editMode) {
        await api.patch('/api/users/profile', payload);
        haptics.success();
        toast.show(i18n.t('toasts.saved'), { variant: 'success' });
        globalThis.location.hash = '/settings';
      } else {
        await api.post('/api/users/onboarding', payload);
        haptics.success();
        toast.show(i18n.t('toasts.welcome_aboard'), { variant: 'success' });
        this.clearDraft();
        globalThis.location.hash = '/home';
      }
    } catch (err) {
      if (err instanceof NetworkError) {
        toast.show(i18n.t('toasts.network_error'), { variant: 'error' });
      } else if (err instanceof ApiError) {
        toast.show(err.message, { variant: 'error' });
      } else {
        toast.show(i18n.t('common.error'), { variant: 'error' });
      }
    }
  }

  buildPayload() {
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const weight = num(this.draft.weight);
    /** @type {Record<string, number> | undefined} */
    let measurement;
    if (weight != null && weight > 20) {
      measurement = { weight };
      for (const k of ['shoulders', 'arm', 'chest', 'waist', 'abs', 'glutes', 'thigh', 'calf']) {
        const v = num(this.draft[k]);
        if (v != null) measurement[k] = v;
      }
    }
    const profile = {
      sex: this.draft.sex,
      dateOfBirth: this.draft.dateOfBirth,
      heightCm: Number(this.draft.heightCm),
      goal: this.draft.goal,
      experienceLevel: this.draft.experienceLevel,
      trainingDaysPerWeek: Number(this.draft.trainingDaysPerWeek),
      equipment: this.draft.equipment ?? [],
      injuries: this.draft.injuries ?? [],
      healthNotes: (this.draft.healthNotes ?? '').trim() || undefined,
    };
    if (this.editMode && !measurement) {
      return { profile };
    }
    return { profile, measurement };
  }

  // ─ Low-level helpers ─────────────────────────────────────────

  labeledBlock(label, ...children) {
    const wrap = Page.el('div', { className: 'input-group' });
    wrap.append(Page.el('label', { className: 'input-label', text: label }));
    for (const c of children) wrap.append(c);
    return wrap;
  }

  /**
   * @param {Array<{id:string,label:string,hint?:string}>} options
   * @param {string|null} value
   * @param {(id: string) => void} onChange
   */
  optionGroup(options, value, onChange) {
    const wrap = Page.el('div', { className: 'onboarding-options' });
    for (const opt of options) {
      const btn = Page.el('button', {
        className: `onboarding-option${opt.id === value ? ' onboarding-option--active' : ''}`,
      });
      btn.type = 'button';
      btn.append(Page.el('span', { className: 'onboarding-option__label', text: opt.label }));
      if (opt.hint) {
        btn.append(Page.el('span', { className: 'onboarding-option__hint', text: opt.hint }));
      }
      this.on(btn, 'click', () => {
        haptics.select();
        onChange(opt.id);
      });
      wrap.append(btn);
    }
    return wrap;
  }

  /** @param {string} value @param {(v: string) => void} onChange */
  dateInput(value, onChange) {
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'date';
    input.value = value ?? '';
    input.max = todayIso();
    this.on(input, 'change', () => onChange(input.value));
    return input;
  }

  /**
   * @param {string|number} value
   * @param {{ min?: number, max?: number, step?: number }} attrs
   * @param {(v: string) => void} onChange
   */
  numberInput(value, attrs, onChange) {
    const input = document.createElement('input');
    input.className = 'input input--numeric';
    input.type = 'number';
    input.inputMode = 'decimal';
    input.value = value == null ? '' : String(value);
    if (attrs.min != null) input.min = String(attrs.min);
    if (attrs.max != null) input.max = String(attrs.max);
    input.step = attrs.step != null ? String(attrs.step) : '1';
    this.on(input, 'input', () => onChange(input.value));
    return input;
  }
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function hideBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = 'none';
}

function showBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = '';
}
