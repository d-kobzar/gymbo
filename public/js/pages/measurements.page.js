import { Page } from './page.base.js';
import { BottomSheet } from '../components/bottom-sheet.js';
import { Lightbox } from '../components/lightbox.js';
import { Skeleton } from '../components/skeleton.js';
import { EmptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';
import { telegram } from '../core/telegram.js';

const METRIC_GROUPS = [
  {
    titleKey: 'measurements.group_core',
    metrics: [
      { id: 'weight', step: 0.1 },
      { id: 'waist' },
      { id: 'abs' },
      { id: 'chest' },
    ],
  },
  {
    titleKey: 'measurements.group_upper',
    metrics: [{ id: 'shoulders' }, { id: 'arm' }],
  },
  {
    titleKey: 'measurements.group_lower',
    metrics: [{ id: 'glutes' }, { id: 'thigh' }, { id: 'calf' }],
  },
];

const TILE_METRICS = ['waist', 'abs', 'shoulders', 'arm', 'glutes', 'thigh', 'calf'];

// Metrics where an increase is an unwanted direction (fat / mass we
// want to trim). For these, delta > 0 lights red and delta < 0 green.
// Everything else flips: muscle-zone circumferences green-on-up.
const RED_WHEN_UP = new Set(['weight', 'abs', 'glutes']);

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
    /** @type {HTMLElement | null} */
    this.historySlot = null;
    /** @type {Set<string>} */
    this.uploadingLabels = new Set();
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

    const photoSection = Page.section(i18n.t('measurements.photos'));
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

    const historySection = Page.section(i18n.t('measurements.history'));
    this.historySlot = Page.el('div', { className: 'measure-history' });
    historySection.append(this.historySlot);
    shell.append(historySection);

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
      this.renderHistory();
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
    const deltaClass = deltaToneClass('weight', delta);
    const hero = Page.el('article', { className: 'measure-hero' });
    hero.innerHTML = `
      <span class="measure-hero__label">${escapeHtml(i18n.t('measurements.weight'))}</span>
      <div class="measure-hero__value">
        ${weight.toFixed(1)}<span class="measure-hero__unit">kg</span>
      </div>
      ${delta != null ? `<span class="measure-hero__delta ${deltaClass}">${deltaStr}</span>` : ''}
      <span class="measure-hero__watermark" aria-hidden="true">W</span>
    `;
    this.heroSlot.replaceChildren(hero);
  }

  renderGrid() {
    if (!this.gridSlot) return;
    const latest = this.history[0] ?? {};
    const previous = this.history[1];
    this.gridSlot.replaceChildren();
    for (const id of TILE_METRICS) {
      const value = latest[id];
      const prevValue = previous?.[id];
      const delta =
        value != null && prevValue != null
          ? Number(value) - Number(prevValue)
          : null;
      const deltaTag =
        delta != null && Math.abs(delta) >= 0.05
          ? `<span class="measure-tile__delta ${deltaToneClass(id, delta)}">${delta > 0 ? '+' : ''}${delta.toFixed(1)}</span>`
          : '';
      const el = Page.el('div', { className: 'measure-tile' });
      el.innerHTML = `
        <span class="measure-tile__label">${escapeHtml(i18n.t(`measurements.${id}`))}</span>
        <div class="measure-tile__row">
          <span class="measure-tile__value">${value != null ? Number(value).toFixed(1) : '—'}</span>
          <span class="measure-tile__unit">cm</span>
          ${deltaTag}
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
      const isUploading = this.uploadingLabels.has(label);

      if (isUploading) {
        const slot = Page.el('div', {
          className: 'photo-slot photo-slot--loading',
        });
        slot.innerHTML = `<div class="photo-slot__spinner" role="status" aria-label="Uploading"></div>`;
        this.photoSlot.append(slot);
        continue;
      }

      if (existing?.signedUrl) {
        const slot = Page.el('button', {
          className: 'photo-slot photo-slot--filled',
        });
        slot.type = 'button';
        slot.innerHTML = `<img alt="${label}" src="${existing.signedUrl}">`;
        this.on(slot, 'click', () => this.openLightbox(existing));
        this.photoSlot.append(slot);
        continue;
      }

      const slot = Page.el('label', { className: 'photo-slot' });
      slot.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>${label.toUpperCase()}</span>
        <input type="file" accept="image/*" data-label="${label}">
      `;
      const input = /** @type {HTMLInputElement|null} */ (
        slot.querySelector('input[type=file]')
      );
      if (input) this.on(input, 'change', this.handlePhoto);
      this.photoSlot.append(slot);
    }
  }

  renderHistory() {
    if (!this.historySlot) return;
    // Latest is the hero at the top of the page; Timeline lists
    // the entries behind it so the athlete can see progression.
    const prior = this.history.slice(1);
    this.historySlot.replaceChildren();
    if (prior.length === 0) {
      const host = Page.el('div');
      new EmptyState(host, {
        heading: i18n.t('measurements.history_empty'),
      }).render();
      this.historySlot.append(host);
      return;
    }

    for (let i = 0; i < prior.length; i++) {
      const m = prior[i];
      const next = prior[i + 1];
      const row = this.renderHistoryRow(m, next);
      this.historySlot.append(row);
    }
  }

  /** @param {any} m @param {any} prev */
  renderHistoryRow(m, prev) {
    const row = Page.el('button', { className: 'measure-history-row' });
    row.type = 'button';
    this.on(row, 'click', (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      // Photo thumbs inside the row have their own click handler —
      // let those win rather than swallow the event at the row level.
      if (target.closest('.measure-history-row__photo')) return;
      haptics.tap();
      this.openDetailSheet(m, prev);
    });
    const [yyyy, mm, dd] = String(m.date ?? '').split('-');
    const monthLabel = new Date(`${m.date}T00:00:00`).toLocaleDateString(
      undefined,
      { month: 'short' },
    );

    const dateCol = Page.el('div', { className: 'measure-history-row__date' });
    dateCol.innerHTML = `
      <span class="measure-history-row__day">${escapeHtml(dd ?? '')}</span>
      <span class="measure-history-row__month">${escapeHtml(
        `${monthLabel} ${yyyy ?? ''}`.trim(),
      )}</span>
    `;
    row.append(dateCol);

    const body = Page.el('div', { className: 'measure-history-row__body' });
    const stats = Page.el('div', { className: 'measure-history-row__stats' });
    const statHtml = [];
    if (m.weight != null) {
      const weight = Number(m.weight);
      const prevWeight = prev?.weight != null ? Number(prev.weight) : null;
      const delta = prevWeight != null ? weight - prevWeight : null;
      let deltaTag = '';
      if (delta != null && Math.abs(delta) >= 0.05) {
        const cls =
          delta > 0
            ? 'measure-history-row__delta--up'
            : 'measure-history-row__delta--down';
        deltaTag = ` <span class="${cls}">${delta > 0 ? '+' : ''}${delta.toFixed(1)}</span>`;
      }
      statHtml.push(
        `<span class="measure-history-row__stat">W <b>${weight.toFixed(1)} kg</b>${deltaTag}</span>`,
      );
    }
    for (const id of ['waist', 'chest', 'arm']) {
      if (m[id] != null) {
        statHtml.push(
          `<span class="measure-history-row__stat">${id.slice(0, 3).toUpperCase()} <b>${Number(m[id]).toFixed(1)}</b></span>`,
        );
      }
    }
    stats.innerHTML = statHtml.join('');
    body.append(stats);

    const photos = Array.isArray(m.photos) ? m.photos : [];
    const withUrl = photos.filter((p) => p?.signedUrl);
    if (withUrl.length > 0) {
      const strip = Page.el('div', { className: 'measure-history-row__photos' });
      for (const p of withUrl) {
        const btn = Page.el('button', {
          className: 'measure-history-row__photo',
        });
        btn.type = 'button';
        btn.innerHTML = `<img alt="${escapeHtml(p.label ?? '')}" src="${p.signedUrl}">`;
        this.on(btn, 'click', () => this.openLightbox(p));
        strip.append(btn);
      }
      body.append(strip);
    }
    row.append(body);
    return row;
  }

  /** @param {any} m @param {any} prev */
  openDetailSheet(m, prev) {
    const d = new Date(`${m.date}T00:00:00`);
    const titleDate = Number.isNaN(d.getTime())
      ? String(m.date ?? '')
      : d.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
    const sheet = new BottomSheet(document.body, { title: titleDate });
    sheet.render();

    const body = Page.el('div', { className: 'measure-detail' });

    const grid = Page.el('div', { className: 'measure-grid' });
    for (const id of ['weight', 'waist', 'abs', 'chest', 'shoulders', 'arm', 'glutes', 'thigh', 'calf']) {
      const value = m[id];
      const prevValue = prev?.[id];
      const delta =
        value != null && prevValue != null
          ? Number(value) - Number(prevValue)
          : null;
      const deltaTag =
        delta != null && Math.abs(delta) >= 0.05
          ? `<span class="measure-detail__delta ${delta > 0 ? 'measure-detail__delta--up' : 'measure-detail__delta--down'}">${delta > 0 ? '+' : ''}${delta.toFixed(1)}</span>`
          : '';
      const unit = id === 'weight' ? i18n.t('common.unit_kg') : i18n.t('common.unit_cm');
      const tile = Page.el('div', { className: 'measure-tile' });
      tile.innerHTML = `
        <span class="measure-tile__label">${escapeHtml(i18n.t(`measurements.${id}`))}</span>
        <div class="measure-detail__tile-value">
          <span class="measure-tile__value">${value != null ? Number(value).toFixed(1) : '—'}</span>
          <span class="measure-tile__unit">${escapeHtml(unit)}</span>
          ${deltaTag}
        </div>
      `;
      grid.append(tile);
    }
    body.append(grid);

    const photos = Array.isArray(m.photos) ? m.photos : [];
    const withUrl = photos.filter((p) => p?.signedUrl);
    if (withUrl.length > 0) {
      const photosWrap = Page.el('div', { className: 'measure-detail__photos' });
      for (const p of withUrl) {
        const btn = Page.el('button', { className: 'measure-detail__photo' });
        btn.type = 'button';
        btn.innerHTML = `
          <img alt="${escapeHtml(p.label ?? '')}" src="${p.signedUrl}">
          <span class="measure-detail__photo-label">${escapeHtml((p.label ?? '').toUpperCase())}</span>
        `;
        this.on(btn, 'click', () => {
          sheet.close();
          this.openLightbox(p);
        });
        photosWrap.append(btn);
      }
      body.append(photosWrap);
    }

    const deleteBtn = Page.el('button', {
      className: 'button button--ghost button--block',
      text: i18n.t('common.delete'),
    });
    deleteBtn.type = 'button';
    this.on(deleteBtn, 'click', async () => {
      if (!globalThis.confirm?.(i18n.t('common.delete') + '?')) return;
      haptics.warning();
      try {
        await api.del(`/api/measurements/${m.id}`);
        toast.show(i18n.t('toasts.deleted'), { variant: 'success' });
        sheet.close();
        await this.load();
      } catch (err) {
        this.handleError(err);
      }
    });
    body.append(deleteBtn);

    sheet.setBody(body);
    sheet.open();
  }

  /** @param {{signedUrl:string, label?:string}} seed */
  openLightbox(seed) {
    // Build a flat list of every photo across history, chronological
    // (oldest first) so swiping forward walks the athlete through
    // their progression. Open at the clicked photo's position.
    const all = [];
    const ordered = [...this.history].sort((a, b) =>
      String(a.date ?? '').localeCompare(String(b.date ?? '')),
    );
    for (const m of ordered) {
      const photos = Array.isArray(m.photos) ? m.photos : [];
      for (const p of photos) {
        if (!p?.signedUrl) continue;
        all.push({ url: p.signedUrl, label: p.label, date: m.date });
      }
    }
    const idx = all.findIndex((p) => p.url === seed.signedUrl);
    haptics.tap();
    new Lightbox(document.body, {
      photos: all,
      initialIndex: Math.max(0, idx),
    }).open();
  }

  handlePhoto = async (event) => {
    const input = /** @type {HTMLInputElement} */ (event.currentTarget);
    const file = input.files?.[0];
    if (!file) return;
    const latest = this.history[0];
    if (!latest) {
      toast.show(i18n.t('toasts.log_a_measurement_first'), { variant: 'info' });
      return;
    }
    const label = input.dataset.label ?? 'front';
    this.uploadingLabels.add(label);
    this.renderPhotos();

    const fd = new FormData();
    fd.append('photo', file);
    fd.append('label', label);
    try {
      await api.upload(`/api/measurements/${latest.id}/photos`, fd);
      haptics.success();
      toast.show(i18n.t('toasts.photo_uploaded'), { variant: 'success' });
      await this.load();
    } catch (err) {
      this.handleError(err);
    } finally {
      this.uploadingLabels.delete(label);
      this.renderPhotos();
    }
  };

  openAddSheet() {
    const sheet = new BottomSheet(document.body, {
      title: i18n.t('measurements.new_entry'),
    });
    sheet.render();

    // Prefill every field with the athlete's most recent value — most
    // circumferences barely move week-over-week, so typing everything
    // from scratch is busy-work. The placeholder still shows for
    // fields the previous entry left blank.
    const previous = this.history[0] ?? {};

    const form = Page.el('form', { className: 'measure-form' });
    form.append(this.renderDateRow());

    /** @type {Record<string, HTMLInputElement>} */
    const inputs = {};
    for (const group of METRIC_GROUPS) {
      const groupEl = Page.el('div', { className: 'measure-form__group' });
      groupEl.append(
        Page.el('span', {
          className: 'measure-form__group-title',
          text: i18n.t(group.titleKey),
        }),
      );
      const grid = Page.el('div', { className: 'measure-form__grid' });
      for (const metric of group.metrics) {
        const field = Page.el('div', { className: 'input-group' });
        const unit = metric.id === 'weight' ? i18n.t('common.unit_kg') : i18n.t('common.unit_cm');
        field.append(
          Page.el('label', {
            className: 'input-label',
            text: `${i18n.t(`measurements.${metric.id}`)} · ${unit}`,
          }),
        );
        const input = document.createElement('input');
        input.className = 'input input--numeric';
        input.type = 'number';
        input.inputMode = 'decimal';
        input.step = metric.step != null ? String(metric.step) : '0.5';
        input.name = metric.id;
        input.placeholder = '—';
        const prev = previous[metric.id];
        if (prev != null) input.value = String(Number(prev));
        inputs[metric.id] = input;
        field.append(input);
        grid.append(field);
      }
      groupEl.append(grid);
      form.append(groupEl);
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
    if (err instanceof NetworkError) toast.show(i18n.t('toasts.network_error'), { variant: 'error' });
    else if (err instanceof ApiError) toast.show(err.message, { variant: 'error' });
    else toast.show(i18n.t('common.error'), { variant: 'error' });
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Classify a metric's delta as "good" or "bad" to drive the
 * green/red color. For weight / belly / glutes an increase is the
 * unwanted direction; for everything else an increase = muscle
 * gain = wanted.
 * @param {string} metricId
 * @param {number | null | undefined} delta
 * @returns {string}
 */
function deltaToneClass(metricId, delta) {
  if (delta == null || Math.abs(delta) < 0.05) return 'measure-delta--flat';
  const up = delta > 0;
  const bad = RED_WHEN_UP.has(metricId) ? up : !up;
  return bad ? 'measure-delta--bad' : 'measure-delta--good';
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
