import { Page } from './page.base.js';
import { ExercisePicker } from '../components/exercise-picker.js';
import { SegmentedControl } from '../components/segmented-control.js';
import { Skeleton } from '../components/skeleton.js';
import { EmptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { api, ApiError, NetworkError } from '../core/api.js';
import { i18n } from '../core/i18n.js';
import { haptics } from '../core/haptics.js';

const METRIC_IDS = /** @type {const} */ (['maxWeight', 'maxReps', 'totalVolume']);
const METRIC_UNITS = { maxWeight: 'kg', maxReps: '', totalVolume: 'kg' };
const METRIC_LABEL_KEYS = {
  maxWeight: 'progress.max_weight',
  maxReps: 'progress.max_reps',
  totalVolume: 'progress.volume',
};

/**
 * Progress page — pick an exercise, pick a metric, see the line
 * chart + delta vs earliest point. Weekly volume bars render the
 * last 7 ISO weeks by total training volume.
 */
export class ProgressPage extends Page {
  constructor(root, props = {}) {
    super(root, props);
    /** @type {Array<{id:number,name:string}>} */
    this.exercises = [];
    /** @type {Array<{date:string,maxWeight:number,maxReps:number,totalVolume:number}>} */
    this.series = [];
    this.metric = METRIC_IDS[0];
    /** @type {number | null} */
    this.exerciseId = null;
    /** @type {string | null} */
    this.exerciseName = null;
    /** @type {HTMLElement | null} */
    this.chartSlot = null;
    /** @type {HTMLElement | null} */
    this.volumeSlot = null;
    /** @type {HTMLElement | null} */
    this.selectorBtn = null;
  }

  render() {
    const shell = Page.el('div', { className: 'page-shell' });

    shell.append(this.renderHeader());
    shell.append(this.renderExerciseSelector());
    shell.append(this.renderMetricTabs());

    this.chartSlot = Page.el('div');
    this.chartSlot.append(this.skeletonCard('200px'));
    shell.append(this.chartSlot);

    const weeklySection = Page.section(i18n.t('progress.weekly_volume'));
    this.volumeSlot = Page.el('div', { className: 'chart-card' });
    this.volumeSlot.append(this.skeletonCard('120px'));
    weeklySection.append(this.volumeSlot);
    shell.append(weeklySection);

    this.root.append(shell);

    void this.loadExercises();
  }

  renderHeader() {
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('h1', {
        className: 'page-header__title',
        text: i18n.t('progress.title'),
      }),
      Page.el('span', {
        className: 'page-header__kicker',
        text: i18n.t('progress.subtitle'),
      }),
    );
    return header;
  }

  renderExerciseSelector() {
    const btn = Page.el('button', { className: 'log-exercise-select' });
    btn.type = 'button';
    btn.innerHTML = `
      <span class="log-exercise-select__placeholder">${escapeHtml(
        i18n.t('progress.select_exercise'),
      )}</span>
      <span class="log-exercise-select__chevron" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>
    `;
    this.on(btn, 'click', () => {
      haptics.tap();
      this.openPicker();
    });
    this.selectorBtn = btn;
    return btn;
  }

  renderMetricTabs() {
    const slot = Page.el('div');
    new SegmentedControl(slot, {
      options: METRIC_IDS.map((id) => ({ id, label: i18n.t(METRIC_LABEL_KEYS[id]) })),
      value: this.metric,
      block: true,
      onChange: (id) => {
        this.metric = id;
        this.renderChart();
      },
    }).render();
    return slot;
  }

  async loadExercises() {
    try {
      const items = await api.get('/api/exercises');
      this.exercises = /** @type {Array<{id:number,name:string}>} */ (items ?? []);
      if (this.exercises[0]) {
        this.selectExercise(this.exercises[0]);
      } else {
        this.renderEmpty();
      }
      void this.loadWeeklyVolume();
    } catch (err) {
      this.handleError(err);
    }
  }

  openPicker() {
    new ExercisePicker(document.body, {
      title: i18n.t('progress.select_exercise'),
      items: this.exercises,
      onSelect: (id) => {
        const ex = this.exercises.find((e) => e.id === id);
        if (ex) this.selectExercise(ex);
      },
    }).open();
  }

  /** @param {{id:number,name:string}} ex */
  selectExercise(ex) {
    this.exerciseId = ex.id;
    this.exerciseName = ex.name;
    if (this.selectorBtn) {
      const placeholder = /** @type {HTMLElement | null} */ (
        this.selectorBtn.querySelector('.log-exercise-select__placeholder')
      );
      if (placeholder) {
        placeholder.textContent = ex.name;
        placeholder.classList.remove('log-exercise-select__placeholder');
      }
    }
    void this.loadSeries();
  }

  async loadSeries() {
    if (!this.exerciseId || !this.chartSlot) return;
    this.chartSlot.replaceChildren(this.skeletonCard('200px'));
    try {
      const series = await api.get(
        `/api/training-logs/progress?exerciseId=${this.exerciseId}`,
      );
      this.series = /** @type {any[]} */ (Array.isArray(series) ? series : []);
      this.renderChart();
    } catch (err) {
      this.handleError(err);
    }
  }

  renderChart() {
    if (!this.chartSlot) return;
    if (this.series.length === 0) {
      this.chartSlot.replaceChildren(this.renderEmpty());
      return;
    }

    const metricId = METRIC_IDS.includes(this.metric) ? this.metric : METRIC_IDS[0];
    const metricLabel = i18n.t(METRIC_LABEL_KEYS[metricId]);
    const metricUnit = METRIC_UNITS[metricId];
    const values = this.series.map((p) => Number(p[metricId] ?? 0));
    const latest = values[values.length - 1] ?? 0;
    const earliest = values[0] ?? 0;
    const delta = latest - earliest;

    const card = Page.el('article', { className: 'chart-card' });
    const head = Page.el('div', { className: 'chart-card__head' });
    const left = Page.el('div');
    left.append(
      Page.el('span', { className: 'chart-card__label', text: metricLabel }),
      (() => {
        const v = Page.el('div');
        v.innerHTML = `
          <span class="chart-card__value">${formatNumber(latest)}</span>
          ${metricUnit ? `<span class="chart-card__unit">${metricUnit}</span>` : ''}
        `;
        return v;
      })(),
    );
    head.append(left);
    if (Math.abs(delta) > 0.0001) {
      const badge = Page.el('span', {
        className: `chart-card__delta${delta < 0 ? ' chart-card__delta--down' : ''}`,
        text: `${delta > 0 ? '+' : ''}${formatNumber(delta)} ${metricUnit}`.trim(),
      });
      head.append(badge);
    }
    card.append(head);
    card.append(this.renderSvgChart(values));
    card.append(this.renderXAxis());

    this.chartSlot.replaceChildren(card);
  }

  /** @param {number[]} values */
  renderSvgChart(values) {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('class', 'chart-card__svg');
    svg.setAttribute('viewBox', '0 0 320 160');
    svg.setAttribute('preserveAspectRatio', 'none');

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = values.length > 1 ? 320 / (values.length - 1) : 0;
    const path = values
      .map((v, i) => {
        const x = i * step;
        const y = 160 - ((v - min) / range) * 140 - 10;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    const gradientId = 'chart-fill-accent';
    const defs = document.createElementNS(svgNs, 'defs');
    defs.innerHTML = `
      <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="currentColor" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
      </linearGradient>
    `;
    svg.append(defs);

    const area = document.createElementNS(svgNs, 'path');
    area.setAttribute('d', `${path} L320 160 L0 160 Z`);
    area.setAttribute('fill', `url(#${gradientId})`);
    area.style.color = 'var(--accent)';
    svg.append(area);

    const line = document.createElementNS(svgNs, 'path');
    line.setAttribute('d', path);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'var(--accent)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    svg.append(line);

    return svg;
  }

  renderXAxis() {
    const axis = Page.el('div', { className: 'chart-card__x-axis' });
    if (this.series.length === 0) return axis;
    const points = this.series.length;
    const indices = points <= 3 ? [0, Math.floor(points / 2), points - 1] : [0, Math.floor(points / 3), Math.floor((2 * points) / 3), points - 1];
    for (const i of indices) {
      const d = new Date(this.series[i]?.date);
      axis.append(
        Page.el('span', {
          text: Number.isNaN(d.getTime())
            ? ''
            : d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        }),
      );
    }
    return axis;
  }

  async loadWeeklyVolume() {
    if (!this.volumeSlot) return;
    try {
      const data = await api.get('/api/stats/volume?weeks=7');
      const list = /** @type {Array<{name:string,totalVolume:number}>} */ (data ?? []);
      this.renderVolumeBars(list.slice(0, 7));
    } catch (err) {
      this.handleError(err);
    }
  }

  /** @param {Array<{name:string,totalVolume:number}>} items */
  renderVolumeBars(items) {
    if (!this.volumeSlot) return;
    if (items.length === 0) {
      this.volumeSlot.replaceChildren(this.renderEmpty(i18n.t('progress.no_volume')));
      return;
    }
    const max = Math.max(...items.map((i) => Number(i.totalVolume ?? 0))) || 1;
    const bars = Page.el('div', { className: 'volume-bars' });
    items.forEach((it, idx) => {
      const bar = Page.el('div', {
        className: `volume-bars__bar${idx === items.length - 1 ? ' volume-bars__bar--current' : ''}`,
      });
      bar.style.height = `${Math.max(8, (Number(it.totalVolume ?? 0) / max) * 72)}px`;
      bars.append(bar);
    });
    const labels = Page.el('div', { className: 'volume-bars__labels' });
    for (const it of items) {
      labels.append(
        Page.el('span', {
          text: (it.name ?? '').slice(0, 6),
        }),
      );
    }
    this.volumeSlot.replaceChildren(bars, labels);
  }

  /** @param {string} [text] */
  renderEmpty(text) {
    const host = Page.el('div');
    new EmptyState(host, {
      heading: text ?? i18n.t('progress.no_data'),
    }).render();
    return host;
  }

  /** @param {string} height */
  skeletonCard(height) {
    const s = Page.el('div');
    new Skeleton(s, { variant: 'card', height }).render();
    return s;
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

/** @param {number} n */
function formatNumber(n) {
  if (Math.abs(n) >= 1000) return Math.round(n).toString();
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
