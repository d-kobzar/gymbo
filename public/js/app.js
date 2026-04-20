/* Page init handlers */
window.PageInit = {};

/* ============================================================
   HOME PAGE
   ============================================================ */
PageInit.home = async function () {
  // Load dashboard stats
  try {
    const stats = await Api.get('/api/stats/dashboard');
    if (stats) {
      const el = (id) => document.getElementById(id);
      if (el('stat-sets-week')) el('stat-sets-week').textContent = stats.setsThisWeek ?? '-';
      if (el('stat-total-sets')) el('stat-total-sets').textContent = stats.totalSets ?? '-';
      if (el('stat-weight')) el('stat-weight').textContent = stats.bodyWeight ? `${stats.bodyWeight} kg` : '-';
      if (el('stat-exercises')) el('stat-exercises').textContent = stats.exerciseCount ?? '-';
    }
  } catch (e) { /* Will show dashes */ }

  // Load recent PRs
  try {
    const prs = await Api.get('/api/stats/prs?limit=5');
    const list = document.getElementById('pr-list');
    if (list && prs && prs.length) {
      list.innerHTML = prs.map(pr => `
        <div class="list-item">
          <div class="list-item-content">
            <div class="list-item-title">${esc(pr.exercise?.name || '')}</div>
            <div class="list-item-subtitle">${pr.maxWeight}kg x ${pr.maxReps}</div>
          </div>
          <span class="pr-badge">PR</span>
        </div>
      `).join('');
    }
  } catch (e) { /* silent */ }
};

/* ============================================================
   LOG PAGE
   ============================================================ */
PageInit.log = async function () {
  const dateInput = document.getElementById('log-date');
  const exerciseSelect = document.getElementById('log-exercise');
  const addBtn = document.getElementById('log-add-btn');
  const logList = document.getElementById('log-entries');
  const restBtn = document.getElementById('rest-timer-btn');
  const restOverlay = document.getElementById('rest-overlay');

  if (dateInput) dateInput.value = todayISO();

  // Load exercises for dropdown
  try {
    const exercises = await Api.get('/api/exercises');
    if (exerciseSelect && exercises) {
      exerciseSelect.innerHTML = `<option value="" data-i18n="workout.select_exercise">${I18n.t('workout.select_exercise')}</option>` +
        exercises.map(ex => `<option value="${ex.id}">${esc(ex.name)}</option>`).join('');
    }
  } catch (e) { /* silent */ }

  // Add set
  if (addBtn) {
    addBtn.onclick = async () => {
      const exerciseId = exerciseSelect.value;
      const reps = parseInt(document.getElementById('log-reps').value);
      const weight = parseFloat(document.getElementById('log-weight').value);
      const rir = parseInt(document.getElementById('log-rir').value);
      const date = dateInput.value;

      if (!exerciseId || !reps) {
        Api.toast(I18n.t('common.error'), 'error');
        return;
      }

      try {
        const result = await Api.post('/api/training-logs', {
          exerciseId: parseInt(exerciseId),
          reps,
          weight: weight || 0,
          rir: isNaN(rir) ? null : rir,
          date
        });
        Api.toast(I18n.t('workout.added'), 'success');
        TG.haptic('success');

        if (result && result.isPR) {
          setTimeout(() => Api.toast(I18n.t('workout.pr_new'), 'success'), 1500);
        }

        // Clear inputs
        document.getElementById('log-reps').value = '';
        document.getElementById('log-weight').value = '';
        document.getElementById('log-rir').value = '';

        // Reload log
        loadTodayLog(dateInput.value, logList);
      } catch (e) {
        Api.toast(e.message || I18n.t('common.error'), 'error');
      }
    };
  }

  // Date change reloads log
  if (dateInput) {
    dateInput.onchange = () => loadTodayLog(dateInput.value, logList);
  }

  // Load today's log
  loadTodayLog(todayISO(), logList);

  // Rest timer
  let restInterval = null;
  if (restBtn) {
    restBtn.onclick = () => {
      const seconds = parseInt(document.getElementById('rest-seconds')?.value) || 90;
      startRestTimer(seconds, restOverlay);
    };
  }
  if (restOverlay) {
    restOverlay.onclick = (e) => {
      if (e.target === restOverlay) {
        restOverlay.classList.remove('active');
        clearInterval(window._restInterval);
      }
    };
  }
};

async function loadTodayLog(date, container) {
  if (!container) return;
  try {
    const sets = await Api.get(`/api/training-logs?date=${date}`);
    if (!sets || !sets.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-text text-dim">${I18n.t('dashboard.no_workouts')}</div></div>`;
      return;
    }

    // Group by exercise
    const grouped = {};
    sets.forEach(s => {
      const name = s.exerciseName || s.exercise?.name || 'Unknown';
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(s);
    });

    container.innerHTML = Object.entries(grouped).map(([name, entries]) => `
      <div class="log-group">
        <div class="log-group-title">${esc(name)}</div>
        ${entries.map((s, i) => `
          <div class="log-entry">
            <span class="log-entry-set">${i + 1}</span>
            <span class="log-entry-detail"><strong>${s.weight || 0}kg</strong> x ${s.reps}${s.rir != null ? ` @ RIR ${s.rir}` : ''}</span>
            <div class="log-entry-actions">
              <button onclick="deleteSet(${s.id})" title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '';
  }
}

async function deleteSet(id) {
  if (!confirm(I18n.t('common.delete') + '?')) return;
  try {
    await Api.del(`/api/training-logs/${id}`);
    Api.toast(I18n.t('workout.deleted'), 'info');
    TG.haptic('light');
    // Reload current log
    const dateInput = document.getElementById('log-date');
    const logList = document.getElementById('log-entries');
    if (dateInput && logList) loadTodayLog(dateInput.value, logList);
  } catch (e) {
    Api.toast(I18n.t('common.error'), 'error');
  }
}

function startRestTimer(totalSeconds, overlay) {
  if (!overlay) return;
  let remaining = totalSeconds;
  const display = overlay.querySelector('.rest-timer-display');
  const ring = overlay.querySelector('.ring-progress');
  const circumference = 2 * Math.PI * 90; // r=90

  if (ring) {
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = 0;
  }

  overlay.classList.add('active');
  TG.haptic('medium');

  clearInterval(window._restInterval);
  window._restInterval = setInterval(() => {
    remaining--;
    if (display) {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      display.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }
    if (ring) {
      const progress = 1 - (remaining / totalSeconds);
      ring.style.strokeDashoffset = circumference * progress;
    }
    if (remaining <= 0) {
      clearInterval(window._restInterval);
      TG.haptic('success');
      setTimeout(() => overlay.classList.remove('active'), 1000);
    }
  }, 1000);

  if (display) {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    display.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }
}

/* ============================================================
   PROGRESS PAGE
   ============================================================ */
PageInit.progress = async function () {
  const exerciseSelect = document.getElementById('progress-exercise');
  const metricChips = document.querySelectorAll('.metric-chip');
  const chartArea = document.getElementById('progress-chart');
  let currentMetric = 'maxWeight';

  try {
    const exercises = await Api.get('/api/exercises');
    if (exerciseSelect && exercises) {
      exerciseSelect.innerHTML = `<option value="">${I18n.t('progress.select_exercise')}</option>` +
        exercises.map(ex => `<option value="${ex.id}">${esc(ex.name)}</option>`).join('');
    }
  } catch (e) { /* silent */ }

  metricChips.forEach(chip => {
    chip.onclick = () => {
      metricChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentMetric = chip.dataset.metric;
      loadChart();
    };
  });

  if (exerciseSelect) exerciseSelect.onchange = loadChart;

  async function loadChart() {
    if (!exerciseSelect || !exerciseSelect.value) {
      if (chartArea) chartArea.innerHTML = `<div class="chart-empty">${I18n.t('progress.no_data')}</div>`;
      return;
    }
    try {
      const data = await Api.get(`/api/training-logs/progress?exerciseId=${exerciseSelect.value}&metric=${currentMetric}`);
      renderChart(chartArea, data, currentMetric);
    } catch (e) {
      if (chartArea) chartArea.innerHTML = `<div class="chart-empty">${I18n.t('progress.no_data')}</div>`;
    }
  }
};

function renderChart(container, data, metric) {
  const fieldByMetric = { maxWeight: 'maxWeight', maxReps: 'maxReps', volume: 'totalVolume' };
  const field = fieldByMetric[metric] || 'maxWeight';
  const points = (data || [])
    .map(d => ({ date: d.date, value: Number(d[field]) }))
    .filter(d => Number.isFinite(d.value));

  if (!container || !points.length) {
    if (container) container.innerHTML = `<div class="chart-empty">${I18n.t('progress.no_data')}</div>`;
    return;
  }

  container.innerHTML = '<canvas></canvas>';
  const canvas = container.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 20, right: 16, bottom: 30, left: 44 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const values = points.map(d => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = rawMin === rawMax ? rawMin - 1 : rawMin * 0.9;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax * 1.1;

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const dim = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim();
  const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();

  // Grid lines
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();

    // Y labels
    const val = max - ((max - min) / 4) * i;
    ctx.fillStyle = dim;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(val), pad.left - 8, y + 4);
  }

  // Line
  ctx.beginPath();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  points.forEach((d, i) => {
    const x = pad.left + (plotW / (points.length - 1 || 1)) * i;
    const y = pad.top + plotH - ((d.value - min) / (max - min || 1)) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  points.forEach((d, i) => {
    const x = pad.left + (plotW / (points.length - 1 || 1)) * i;
    const y = pad.top + plotH - ((d.value - min) / (max - min || 1)) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
  });

  // X labels (first and last date)
  ctx.fillStyle = dim;
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  if (points[0]?.date) ctx.fillText(formatDateShort(points[0].date), pad.left, h - 6);
  ctx.textAlign = 'right';
  if (points[points.length - 1]?.date) ctx.fillText(formatDateShort(points[points.length - 1].date), w - pad.right, h - 6);
}

/* ============================================================
   MORE PAGE
   ============================================================ */
PageInit.more = function () {
  // Nothing special, it's a static menu
};

/* ============================================================
   PROGRAM PAGE
   ============================================================ */
PageInit.program = async function () {
  const versionSelect = document.getElementById('program-version');
  const weekGrid = document.getElementById('program-week');
  const newVersionBtn = document.getElementById('program-new-version');

  try {
    const programs = await Api.get('/api/programs');
    if (versionSelect && programs && programs.length) {
      versionSelect.innerHTML = programs.map((p, i) => `<option value="${p.id}" ${i === 0 ? 'selected' : ''}>${I18n.t('program.version')} ${p.version || i + 1}</option>`).join('');
      loadProgram(programs[0].id);
    } else if (weekGrid) {
      weekGrid.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('program.no_program')}</div></div>`;
    }
  } catch (e) { /* silent */ }

  if (versionSelect) {
    versionSelect.onchange = () => loadProgram(versionSelect.value);
  }

  if (newVersionBtn) {
    newVersionBtn.onclick = async () => {
      try {
        const result = await Api.post('/api/programs', {});
        Api.toast('Created!', 'success');
        PageInit.program();
      } catch (e) {
        Api.toast(e.message || I18n.t('common.error'), 'error');
      }
    };
  }

  async function loadProgram(id) {
    if (!weekGrid) return;
    try {
      const program = await Api.get(`/api/programs/${id}`);
      if (!program || !program.days) {
        weekGrid.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('program.no_program')}</div></div>`;
        return;
      }
      const dayNames = ['common.mon', 'common.tue', 'common.wed', 'common.thu', 'common.fri', 'common.sat', 'common.sun'];
      weekGrid.innerHTML = program.days.map((day, i) => {
        if (!day.exercises || !day.exercises.length) {
          return `<div class="day-card rest"><span>${I18n.t(dayNames[i])} - ${I18n.t('program.rest_day')}</span></div>`;
        }
        return `
          <div class="day-card">
            <div class="day-card-title">${I18n.t(dayNames[i])}</div>
            ${day.exercises.map(ex => `<div class="day-card-exercise">${esc(ex.exercise?.name || '')} <span class="text-dim">${ex.sets} ${I18n.t('program.sets')}</span></div>`).join('')}
          </div>`;
      }).join('');
    } catch (e) {
      weekGrid.innerHTML = '';
    }
  }
};

/* ============================================================
   MEASUREMENTS PAGE
   ============================================================ */
PageInit.measurements = async function () {
  const form = document.getElementById('measurements-form');
  const saveBtn = document.getElementById('measurements-save');
  const historyList = document.getElementById('measurements-history');
  const photoSlots = document.querySelectorAll('.photo-slot input');

  if (form) {
    const dateInput = form.querySelector('[name="date"]');
    if (dateInput) dateInput.value = todayISO();
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      if (!form) return;
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());

      try {
        const created = await Api.post('/api/measurements', data);
        const id = created?.id;

        if (id) {
          const photoInputs = form.querySelectorAll('.photo-slot input[type="file"]');
          for (const input of photoInputs) {
            if (input.files && input.files[0]) {
              try {
                const pfd = new FormData();
                pfd.append('photo', input.files[0]);
                if (input.dataset.type) pfd.append('label', input.dataset.type);
                await Api.upload(`/api/measurements/${id}/photos`, pfd);
              } catch (e) { /* skip failed photo */ }
            }
          }
        }

        Api.toast(I18n.t('measurements.added'), 'success');
        TG.haptic('success');
        loadMeasurementHistory(historyList);
      } catch (e) {
        Api.toast(e.message || I18n.t('common.error'), 'error');
      }
    };
  }

  // Photo preview
  photoSlots.forEach(input => {
    input.onchange = () => {
      const slot = input.closest('.photo-slot');
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          let img = slot.querySelector('img');
          if (!img) {
            img = document.createElement('img');
            slot.appendChild(img);
          }
          img.src = e.target.result;

          let removeBtn = slot.querySelector('.photo-remove');
          if (!removeBtn) {
            removeBtn = document.createElement('button');
            removeBtn.className = 'photo-remove';
            removeBtn.textContent = '\u00d7';
            removeBtn.onclick = (ev) => {
              ev.stopPropagation();
              input.value = '';
              img.remove();
              removeBtn.remove();
            };
            slot.appendChild(removeBtn);
          }
        };
        reader.readAsDataURL(input.files[0]);
      }
    };
  });

  // Collapsible form
  const collHeader = document.querySelector('.collapsible-header');
  if (collHeader) {
    collHeader.onclick = () => {
      collHeader.classList.toggle('open');
      const body = collHeader.nextElementSibling;
      if (body) body.classList.toggle('open');
    };
  }

  loadMeasurementHistory(historyList);
};

async function loadMeasurementHistory(container) {
  if (!container) return;
  try {
    const items = await Api.get('/api/measurements?limit=10');
    if (!items || !items.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-text text-dim">${I18n.t('common.no_data')}</div></div>`;
      return;
    }
    container.innerHTML = items.map(m => `
      <div class="list-item">
        ${m.photoUrl ? `<img class="measurement-thumb" src="${m.photoUrl}" alt="">` : ''}
        <div class="list-item-content">
          <div class="list-item-title">${formatDateShort(m.date)}</div>
          <div class="list-item-subtitle">${m.weight ? m.weight + ' kg' : ''} ${m.chest ? '| chest ' + m.chest : ''} ${m.waist ? '| waist ' + m.waist : ''}</div>
        </div>
        <button class="btn-icon" onclick="deleteMeasurement(${m.id})" style="width:32px;height:32px;border:none;background:transparent;color:var(--text-dim)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '';
  }
}

async function deleteMeasurement(id) {
  if (!confirm(I18n.t('common.delete') + '?')) return;
  try {
    await Api.del(`/api/measurements/${id}`);
    Api.toast(I18n.t('measurements.deleted'), 'info');
    const historyList = document.getElementById('measurements-history');
    loadMeasurementHistory(historyList);
  } catch (e) {
    Api.toast(I18n.t('common.error'), 'error');
  }
}

/* ============================================================
   EXERCISES PAGE
   ============================================================ */
PageInit.exercises = async function () {
  const searchInput = document.getElementById('exercises-search');
  const addInput = document.getElementById('exercise-name-input');
  const addBtn = document.getElementById('exercise-add-btn');
  const list = document.getElementById('exercises-list');
  let exercises = [];

  async function loadExercises() {
    try {
      exercises = await Api.get('/api/exercises') || [];
      renderExercises(exercises);
    } catch (e) { /* silent */ }
  }

  function renderExercises(items) {
    if (!list) return;
    if (!items.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-text text-dim">${I18n.t('common.no_data')}</div></div>`;
      return;
    }
    list.innerHTML = items.map(ex => `
      <div class="list-item">
        <div class="list-item-content">
          <div class="list-item-title">${esc(ex.name)}</div>
        </div>
        <div class="list-item-action">
          <button class="btn-icon" onclick="deleteExercise(${ex.id})" style="width:32px;height:32px;border:none;background:transparent;color:var(--text-dim)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  if (searchInput) {
    searchInput.oninput = () => {
      const q = searchInput.value.toLowerCase();
      renderExercises(exercises.filter(ex => ex.name.toLowerCase().includes(q)));
    };
  }

  if (addBtn && addInput) {
    addBtn.onclick = async () => {
      const name = addInput.value.trim();
      if (!name) return;
      try {
        await Api.post('/api/exercises', { name });
        Api.toast(I18n.t('exercises.added'), 'success');
        TG.haptic('success');
        addInput.value = '';
        loadExercises();
      } catch (e) {
        Api.toast(e.message || I18n.t('exercises.duplicate'), 'error');
      }
    };
    addInput.onkeydown = (e) => {
      if (e.key === 'Enter') addBtn.onclick();
    };
  }

  loadExercises();
};

async function deleteExercise(id) {
  if (!confirm(I18n.t('common.delete') + '?')) return;
  try {
    await Api.del(`/api/exercises/${id}`);
    Api.toast(I18n.t('exercises.deleted'), 'info');
    TG.haptic('light');
    PageInit.exercises();
  } catch (e) {
    Api.toast(I18n.t('common.error'), 'error');
  }
}

/* ============================================================
   SETTINGS PAGE
   ============================================================ */
PageInit.settings = async function () {
  const langPills = document.querySelectorAll('.lang-pill');
  const themeToggle = document.getElementById('setting-theme');
  const trainingToggle = document.getElementById('setting-training-reminder');
  const trainingTime = document.getElementById('setting-training-time');
  const measurementToggle = document.getElementById('setting-measurement-reminder');
  const importBtn = document.getElementById('import-file');
  const exportBtn = document.getElementById('export-btn');

  // Set current lang pill
  langPills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.lang === I18n.lang);
    pill.onclick = async () => {
      langPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      await I18n.setLang(pill.dataset.lang);
      // Re-apply current page
      I18n.apply(document.getElementById('page-container'));
      I18n.apply(document.getElementById('tab-bar'));
      try {
        await Api.put('/api/notifications', { language: pill.dataset.lang });
      } catch (e) { /* silent */ }
    };
  });

  // Theme toggle
  if (themeToggle) {
    themeToggle.checked = document.documentElement.getAttribute('data-theme') === 'light';
    themeToggle.onchange = () => {
      const theme = themeToggle.checked ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('gymbo_theme', theme);
      TG.haptic('light');
    };
  }

  // Load current settings
  try {
    const settings = await Api.get('/api/notifications');
    if (settings) {
      if (trainingToggle) trainingToggle.checked = settings.trainingReminder || false;
      if (trainingTime) trainingTime.value = settings.trainingTime || '18:00';
      if (measurementToggle) measurementToggle.checked = settings.measurementReminder || false;
    }
  } catch (e) { /* silent */ }

  // Save notification settings on change
  [trainingToggle, trainingTime, measurementToggle].forEach(el => {
    if (el) {
      el.onchange = async () => {
        try {
          await Api.put('/api/notifications', {
            trainingReminder: trainingToggle?.checked || false,
            trainingTime: trainingTime?.value || '18:00',
            measurementReminder: measurementToggle?.checked || false
          });
          Api.toast(I18n.t('settings.saved'), 'success');
        } catch (e) { /* silent */ }
      };
    }
  });

  // Import
  if (importBtn) {
    importBtn.onchange = async () => {
      const file = importBtn.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await Api.post('/api/backup/import', data);
        Api.toast('Imported!', 'success');
        TG.haptic('success');
      } catch (e) {
        Api.toast(e.message || I18n.t('common.error'), 'error');
      }
    };
  }

  // Export
  if (exportBtn) {
    exportBtn.onclick = async () => {
      try {
        const data = await Api.get('/api/backup/export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gymbo-export-${todayISO()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Api.toast('Exported!', 'success');
      } catch (e) {
        Api.toast(I18n.t('common.error'), 'error');
      }
    };
  }
};

/* ============================================================
   HELPERS
   ============================================================ */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDateShort(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

/* ============================================================
   APP INIT
   ============================================================ */
(async () => {
  // Apply saved theme
  const savedTheme = localStorage.getItem('gymbo_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  TG.init();
  await Api.init();
  await I18n.init();

  // Apply translations to shell (tab bar)
  I18n.apply(document.getElementById('tab-bar'));

  Router.init();
})();
