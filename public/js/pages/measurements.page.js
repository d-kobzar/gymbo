import { Page } from './page.base.js';
import { BottomSheet } from '../components/bottom-sheet.js';
import { Skeleton } from '../components/skeleton.js';
import { EmptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';
import { telegram } from '../core/telegram.js';

const METRIC_GROUPS = [
  {
    title: 'Core',
    metrics: [
      { id: 'weight', label: 'Weight', unit: 'kg', step: 0.1 },
      { id: 'waist', label: 'Waist', unit: 'cm' },
      { id: 'abs', label: 'Abs', unit: 'cm' },
      { id: 'chest', label: 'Chest', unit: 'cm' },
    ],
  },
  {
    title: 'Upper',
    metrics: [
      { id: 'shoulders', label: 'Shoulders', unit: 'cm' },
      { id: 'arm', label: 'Arm', unit: 'cm' },
    ],
  },
  {
    title: 'Lower',
    metrics: [
      { id: 'glutes', label: 'Glutes', unit: 'cm' },
      { id: 'thigh', label: 'Thigh', unit: 'cm' },
      { id: 'calf', label: 'Calf', unit: 'cm' },
    ],
  },
];

const TILE_METRICS = [
  { id: 'chest', label: 'Chest', unit: 'cm' },
  { id: 'waist', label: 'Waist', unit: 'cm' },
  { id: 'arm', label: 'Arm', unit: 'cm' },
  { id: 'thigh', label: 'Thigh', unit: 'cm' },
  { id: 'glutes', label: 'Glutes', unit: 'cm' },
  { id: 'shoulders', label: 'Shoulders', unit: 'cm' },
];

const PHOTO_LABELS = ['front', 'side', 'back'];

/**
 * Measurements page — hero latest-weight card + 6-tile grid of
 * circumference metrics + 3-slot photo row. Add-measurement form
 * in a BottomSheet covers the full 11 metrics in core/upper/lower
 * groups.
 */
export class MeasurementsPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {any[]} */
    this.history = [];
    /** @type {HTMLElement | null} */
    this.heroSlot = null;
    /** @type {HTMLElement | null} */
    this.gridSlot = null;
    /** @type {HTMLElement | null} */
    this.photoSlot = null;
  }

  render() {
    const shell = Page.el('div', { className: 'page-shell' });
    shell.append(this.renderHeader());

    this.heroSlot = Page.el('div');
    this.heroSlot.append(this.skeletonCard('140px'));
    shell.append(this.heroSlot);

    this.gridSlot = Page.el('div', { className: 'measure-grid' });
    for (let i = 0; i < 6; i++) this.gridSlot.append(this.skeletonCard('74px'));
    shell.append(this.gridSlot);

    const photoSection = Page.section('Photos');
    this.photoSlot = Page.el('div', { className: 'photo-grid' });
    shell.append(photoSection);
    photoSection.append(this.photoSlot);

    const addBtn = Page.el('button', {
      className: 'button button--primary button--lg button--block',
      text: i18n.t('measurements.new_entry'),
    });
    this.on(addBtn, 'click', () => {
      haptics.tap();
      this.openAddSheet();
    });
    shell.append(addBtn);

    this.root.append(shell);
    void this.load();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('measurements.page_title'),
      }),
      Page.el('span', {
        className: 'page-header__kicker',
        text: i18n.t('measurements.subtitle'),
      }),
    );
    return header;
  }

  async load() {
    try {
      const res = await api.get('/api/measurements?limit=30');
      const payload = /** @type {{ data: any[] }} */ (res);
      this.history = Array.isArray(payload?.data) ? payload.data : [];
      this.renderHero();
      this.renderGrid();
      this.renderPhotos();
    } catch (err) {
      this.handleError(err);
    }
  }

  renderHero() {
    if (!this.heroSlot) return;
    const latest = this.history[0];
    if (!latest?.weight) {
      const host = Page.el('div');
      new EmptyState(host, {
        heading: 'No measurements yet',
        description: 'Log weight and circumferences to track your composition over time.',
      }).render();
      this.heroSlot.replaceChildren(host);
      return;
    }
    const previous = this.history.find((m, idx) => idx > 0 && m.weight != null);
    const weight = Number(latest.weight);
    const prev = previous ? Number(previous.weight) : null;
    const delta = prev != null ? weight - prev : null;
    const deltaStr = delta == null
      ? ''
      : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${delta < 0 ? '↓' : '↑'}`;
    const hero = Page.el('article', { className: 'measure-hero' });
    hero.innerHTML = `
      <span class="measure-hero__label">Weight</span>
      <div class="measure-hero__value">
        ${weight.toFixed(1)}<span class="measure-hero__unit">kg</span>
      </div>
      ${delta != null ? `<span class="measure-hero__delta">${deltaStr}</span>` : ''}
      <span class="measure-hero__watermark" aria-hidden="true">W</span>
    `;
    this.heroSlot.replaceChildren(hero);
  }

  renderGrid() {
    if (!this.gridSlot) return;
    const latest = this.history[0] ?? {};
    this.gridSlot.replaceChildren();
    for (const tile of TILE_METRICS) {
      const value = latest[tile.id];
      const el = Page.el('div', { className: 'measure-tile' });
      el.innerHTML = `
        <span class="measure-tile__label">${tile.label}</span>
        <div>
          <span class="measure-tile__value">${value != null ? Number(value).toFixed(1) : '—'}</span>
          <span class="measure-tile__unit">${tile.unit}</span>
        </div>
      `;
      this.gridSlot.append(el);
    }
  }

  renderPhotos() {
    if (!this.photoSlot) return;
    const latest = this.history[0];
    const photos = Array.isArray(latest?.photos) ? latest.photos : [];
    this.photoSlot.replaceChildren();
    for (const label of PHOTO_LABELS) {
      const existing = photos.find((p) => p.label === label);
      const slot = Page.el('label', {
        className: `photo-slot${existing ? ' photo-slot--filled' : ''}`,
      });
      if (existing?.signedUrl) {
        slot.innerHTML = `<img alt="${label}" src="${existing.signedUrl}">`;
      } else {
        slot.innerHTML = `
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>${label.toUpperCase()}</span>
          <input type="file" accept="image/*" data-label="${label}">
        `;
      }
      const input = /** @type {HTMLInputElement|null} */ (slot.querySelector('input[type=file]'));
      if (input) this.on(input, 'change', this.handlePhoto);
      this.photoSlot.append(slot);
    }
  }

  handlePhoto = async (event) => {
    const input = /** @type {HTMLInputElement} */ (event.currentTarget);
    const file = input.files?.[0];
    if (!file) return;
    const latest = this.history[0];
    if (!latest) {
      toast.show('Log a measurement first', { variant: 'info' });
      return;
    }
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('label', input.dataset.label ?? 'front');
    try {
      await api.upload(`/api/measurements/${latest.id}/photos`, fd);
      haptics.success();
      toast.show('Photo uploaded', { variant: 'success' });
      await this.load();
    } catch (err) {
      this.handleError(err);
    }
  };

  openAddSheet() {
    const sheet = new BottomSheet(document.body, {
      title: i18n.t('measurements.new_entry'),
    });
    sheet.render();

    const form = Page.el('form', { className: 'measure-form' });
    form.append(this.renderDateRow());

    /** @type {Record<string, HTMLInputElement>} */
    const inputs = {};
    for (const group of METRIC_GROUPS) {
      form.append(
        Page.el('span', { className: 'measure-form__group-title', text: group.title }),
      );
      const grid = Page.el('div', { className: 'grid-2' });
      for (const metric of group.metrics) {
        const field = Page.el('div', { className: 'input-group' });
        field.append(Page.el('label', { className: 'input-label', text: metric.label }));
        const input = document.createElement('input');
        input.className = 'input input--numeric';
        input.type = 'number';
        input.inputMode = 'decimal';
        input.step = metric.step != null ? String(metric.step) : '0.5';
        input.name = metric.id;
        inputs[metric.id] = input;
        field.append(input);
        grid.append(field);
      }
      form.append(grid);
    }

    const save = Page.el('button', {
      className: 'button button--primary button--lg button--block',
      text: i18n.t('common.save'),
    });
    save.type = 'submit';
    form.append(save);

    this.on(form, 'submit', async (event) => {
      event.preventDefault();
      const payload = { date: todayIso() };
      for (const [id, el] of Object.entries(inputs)) {
        const raw = el.value.trim();
        if (raw !== '') payload[id] = Number(raw);
      }
      try {
        await api.post('/api/measurements', payload);
        haptics.success();
        toast.show(i18n.t('measurements.added'), { variant: 'success' });
        sheet.close();
        await this.load();
      } catch (err) {
        this.handleError(err);
      }
    });

    sheet.setBody(form);
    sheet.open();
    // In-page Save button inside the form handles submit; Telegram
    // MainButton is intentionally unused (wrong color for V2).
  }

  renderDateRow() {
    const wrap = Page.el('div', { className: 'input-group' });
    wrap.append(Page.el('label', { className: 'input-label', text: i18n.t('measurements.date') }));
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'date';
    input.value = todayIso();
    input.name = 'date';
    wrap.append(input);
    return wrap;
  }

  /** @param {string} height */
  skeletonCard(height) {
    const s = Page.el('div');
    new Skeleton(s, { variant: 'card', height }).render();
    return s;
  }

  destroy() {
    telegram.mainButton.hide();
    super.destroy();
  }

  /** @param {unknown} err */
  handleError(err) {
    if (err instanceof NetworkError) toast.show('Network error.', { variant: 'error' });
    else if (err instanceof ApiError) toast.show(err.message, { variant: 'error' });
    else toast.show(i18n.t('common.error'), { variant: 'error' });
  }
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
