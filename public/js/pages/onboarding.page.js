import { Page } from './page.base.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { haptics } from '../core/haptics.js';
import { i18n } from '../core/i18n.js';

const DRAFT_KEY = 'gymbo_onboarding_draft';
const STEP_COUNT = 6;

const SEX_OPTIONS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
];
const GOAL_OPTIONS = [
  { id: 'hypertrophy', label: 'Hypertrophy', hint: 'Build muscle' },
  { id: 'strength', label: 'Strength', hint: 'Max load' },
  { id: 'cut', label: 'Cut', hint: 'Lose fat, keep muscle' },
  { id: 'maintenance', label: 'Maintain', hint: 'Stay where you are' },
];
const LEVEL_OPTIONS = [
  { id: 'beginner', label: 'Beginner', hint: '< 1 y training' },
  { id: 'intermediate', label: 'Intermediate', hint: '1–3 y training' },
  { id: 'advanced', label: 'Advanced', hint: '3+ y training' },
];
const EQUIPMENT_OPTIONS = [
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbell', label: 'Dumbbell' },
  { id: 'machines', label: 'Machines' },
  { id: 'cables', label: 'Cables' },
  { id: 'bodyweight', label: 'Bodyweight' },
];

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
 * State is held in `this.draft` and mirrored into localStorage on
 * every input so closing the Mini App doesn't lose progress.
 *
 * Also serves as "edit profile" when `props.editMode === true`:
 *   - Seeds `this.draft` from an already-loaded profile/measurement.
 *   - Cancel navigates back instead of blocking.
 *   - Final submit uses PATCH instead of POST (future hook; for now
 *     we reuse POST server-side during the onboarding flow).
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
    const seed = /** @type {Record<string, unknown>} */ (this.props.seed ?? null);
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
    if (seed) Object.assign(base, seed);
    try {
      const raw = globalThis.localStorage?.getItem(DRAFT_KEY);
      if (raw) Object.assign(base, JSON.parse(raw));
    } catch {
      /* ignore malformed draft */
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
      Page.el('span', { className: 'onboarding-header__kicker', text: `Step ${this.stepIdx + 1} of ${STEP_COUNT}` }),
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

    if (this.stepIdx > 0) {
      const back = Page.el('button', {
        className: 'button button--ghost button--lg',
        text: 'Back',
      });
      back.type = 'button';
      this.on(back, 'click', () => {
        haptics.tap();
        this.stepIdx -= 1;
        this.renderStep();
      });
      this.actionsSlot.append(back);
    }

    const isLast = this.stepIdx === STEP_COUNT - 1;
    const next = Page.el('button', {
      className: 'button button--primary button--lg',
      text: isLast ? (this.editMode ? 'Save' : 'Finish') : 'Continue',
    });
    next.type = 'button';
    this.on(next, 'click', () => {
      if (!this.canAdvance()) {
        haptics.error();
        toast.show('Please fill the required fields to continue.', {
          variant: 'warning',
        });
        return;
      }
      haptics.tap();
      if (isLast) {
        void this.submit();
      } else {
        this.stepIdx += 1;
        this.renderStep();
      }
    });
    this.actionsSlot.append(next);
  }

  stepMeta() {
    return [
      {
        title: 'About you',
        hint:
          'The coach needs sex, birthday, and height to tailor volume, calorie targets, and 1RM estimates.',
      },
      {
        title: 'Your training',
        hint: 'Current goal, experience level, and how many days a week you can realistically hit the gym.',
      },
      {
        title: 'Equipment',
        hint: 'What you actually have access to. Pick everything that applies.',
      },
      {
        title: 'Health check',
        hint:
          'List current or recurring injuries and anything the coach should keep in mind (meds, conditions, age-related caveats).',
      },
      {
        title: 'First measurement',
        hint:
          'Weight is required. Circumferences are optional — but the more you give, the better the tracking.',
      },
      {
        title: 'Review',
        hint: 'One last look before we hand this to the coach.',
      },
    ][this.stepIdx];
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
        return true; // optional
      case 4:
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
        'Sex',
        this.optionGroup(SEX_OPTIONS, this.draft.sex, (id) => {
          this.draft.sex = id;
          this.saveDraft();
          this.renderStep();
        }),
      ),
      this.labeledBlock(
        'Date of birth',
        this.dateInput(this.draft.dateOfBirth, (v) => {
          this.draft.dateOfBirth = v;
          this.saveDraft();
        }),
      ),
      this.labeledBlock(
        'Height (cm)',
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
        'Goal',
        this.optionGroup(GOAL_OPTIONS, this.draft.goal, (id) => {
          this.draft.goal = id;
          this.saveDraft();
          this.renderStep();
        }),
      ),
      this.labeledBlock(
        'Experience',
        this.optionGroup(LEVEL_OPTIONS, this.draft.experienceLevel, (id) => {
          this.draft.experienceLevel = id;
          this.saveDraft();
          this.renderStep();
        }),
      ),
      this.labeledBlock(
        'Training days / week',
        this.numberInput(
          this.draft.trainingDaysPerWeek,
          { min: 1, max: 7 },
          (v) => {
            this.draft.trainingDaysPerWeek = v;
            this.saveDraft();
          },
        ),
      ),
    );
    return wrap;
  }

  renderEquipmentStep() {
    const wrap = Page.el('div');
    const chips = Page.el('div', { className: 'onboarding-chips' });
    const equipment = /** @type {string[]} */ (this.draft.equipment ?? []);
    for (const opt of EQUIPMENT_OPTIONS) {
      const chip = Page.el('button', {
        className: `onboarding-chip${equipment.includes(opt.id) ? ' onboarding-chip--active' : ''}`,
        text: opt.label,
      });
      chip.type = 'button';
      this.on(chip, 'click', () => {
        haptics.select();
        const next = equipment.includes(opt.id)
          ? equipment.filter((e) => e !== opt.id)
          : [...equipment, opt.id];
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

    const addRow = Page.el('div', { className: 'grid-2' });
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'text';
    input.placeholder = 'e.g. right knee, lower back';
    input.value = this.draft.injuryInput ?? '';
    this.on(input, 'input', () => {
      this.draft.injuryInput = input.value;
      this.saveDraft();
    });
    const addBtn = Page.el('button', {
      className: 'button button--secondary button--lg',
      text: 'Add',
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
    textarea.placeholder =
      'Anything else the coach should keep in mind (meds, conditions, age-related caveats)...';
    textarea.value = this.draft.healthNotes ?? '';
    this.on(textarea, 'input', () => {
      this.draft.healthNotes = textarea.value;
      this.saveDraft();
    });

    wrap.append(
      this.labeledBlock('Injuries', chips, addRow),
      this.labeledBlock('Health notes (optional)', textarea),
    );
    return wrap;
  }

  renderMeasurementStep() {
    const wrap = Page.el('div');
    const fields = [
      { id: 'weight', label: 'Weight (kg)', required: true, step: 0.1 },
      { id: 'waist', label: 'Waist (cm)' },
      { id: 'chest', label: 'Chest (cm)' },
      { id: 'shoulders', label: 'Shoulders (cm)' },
      { id: 'arm', label: 'Arm (cm)' },
      { id: 'thigh', label: 'Thigh (cm)' },
      { id: 'glutes', label: 'Glutes (cm)' },
      { id: 'abs', label: 'Abs (cm)' },
      { id: 'calf', label: 'Calf (cm)' },
    ];
    const grid = Page.el('div', { className: 'onboarding-measurements' });
    for (const f of fields) {
      grid.append(
        this.labeledBlock(
          f.required ? `${f.label} *` : f.label,
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
      ['Sex', this.draft.sex],
      ['Birthday', this.draft.dateOfBirth],
      ['Height', `${this.draft.heightCm} cm`],
      ['Goal', this.draft.goal],
      ['Level', this.draft.experienceLevel],
      ['Days / week', this.draft.trainingDaysPerWeek],
      [
        'Equipment',
        (this.draft.equipment ?? []).join(', ') || '—',
      ],
      [
        'Injuries',
        (this.draft.injuries ?? []).join(', ') || 'none',
      ],
      ['Weight', `${this.draft.weight} kg`],
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
      await api.post('/api/users/onboarding', payload);
      haptics.success();
      toast.show('Welcome aboard.', { variant: 'success' });
      this.clearDraft();
      globalThis.location.hash = '/home';
    } catch (err) {
      if (err instanceof NetworkError) {
        toast.show('Network error. Try again.', { variant: 'error' });
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
    const measurement = { weight: Number(this.draft.weight) };
    for (const k of ['shoulders', 'arm', 'chest', 'waist', 'abs', 'glutes', 'thigh', 'calf']) {
      const v = num(this.draft[k]);
      if (v != null) measurement[k] = v;
    }
    return {
      profile: {
        sex: this.draft.sex,
        dateOfBirth: this.draft.dateOfBirth,
        heightCm: Number(this.draft.heightCm),
        goal: this.draft.goal,
        experienceLevel: this.draft.experienceLevel,
        trainingDaysPerWeek: Number(this.draft.trainingDaysPerWeek),
        equipment: this.draft.equipment ?? [],
        injuries: this.draft.injuries ?? [],
        healthNotes: (this.draft.healthNotes ?? '').trim() || undefined,
      },
      measurement,
    };
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
    const wrap = Page.el('div', {
      className: `onboarding-options${options.length <= 2 ? '' : ''}`,
    });
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
