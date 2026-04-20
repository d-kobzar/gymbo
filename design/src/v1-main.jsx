// Variant 1 — ENERGETIC LIGHT (Nike-inspired)
// Bold Archivo type, white base, amber #F59E0B accent, minimal chrome
const V1 = {
  accent: '#F59E0B',
  accentDeep: '#D97706',
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  ink: '#0A0A0A',
  muted: '#6B6B6B',
  dim: '#A8A39A',
  border: 'rgba(10,10,10,0.08)',
  success: '#16A34A',
  danger: '#DC2626',
  pill: '#EFEAE0',
};

const V1_STYLE = {
  font: { fontFamily: 'Archivo, system-ui, sans-serif' },
};

// ────────── HOME ──────────
function V1Home() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].home;
  const s = V1;
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, ...V1_STYLE.font }}>
      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: s.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.today}</div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.2, color: s.ink, lineHeight: 1.05, marginTop: 6 }}>{t.greeting}</div>
        <div style={{ fontSize: 16, color: s.muted, marginTop: 4, fontWeight: 500 }}>{t.subtitle}</div>
      </div>

      {/* Hero start-workout card */}
      <div style={{ margin: '6px 16px 16px', background: s.ink, borderRadius: 24, padding: 20, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        {/* abstract stripes bg */}
        <div style={{ position: 'absolute', right: -30, top: -20, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${s.accent}55 0%, transparent 70%)` }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-block', background: s.accent, color: '#000', fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>{t.nextUp}</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.6, marginTop: 12, lineHeight: 1.15 }}>{t.upperA}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: 500 }}>{t.exercises}</div>
          <button style={{ marginTop: 16, width: '100%', height: 50, borderRadius: 14, background: s.accent, color: '#000', border: 'none', fontSize: 15, fontWeight: 800, letterSpacing: 0.2, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Archivo' }}>
            {t.startWorkout}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>

      {/* Week stats */}
      <div style={{ padding: '4px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: s.ink, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t.week}</div>
        <div style={{ fontSize: 11, color: s.muted, fontWeight: 600 }}>W17 · APR</div>
      </div>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard v1 label={t.sets} value="47" sub="+8" good />
        <StatCard v1 label={t.volume} value="12.4" sub="t" big />
        <StatCard v1 label={t.days} value="4/5" accent />
        <StatCard v1 label={t.streak} value="12" sub="🔥" streak />
      </div>

      {/* Coach tip */}
      <div style={{ margin: '18px 16px 0', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 20, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: s.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.accent, fontWeight: 900, fontSize: 16, fontFamily: 'Archivo' }}>AI</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: s.ink, letterSpacing: -0.1 }}>{t.coachTip}</div>
            <div style={{ fontSize: 11, color: s.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>GymBo Coach</div>
          </div>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.45, color: '#2a2a2a', fontWeight: 500 }}>{t.coachMsg}</div>
        <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, color: s.accentDeep, fontSize: 13, fontWeight: 700 }}>
          {t.askCoach}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </div>
      </div>

      {/* Records */}
      <div style={{ padding: '18px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: s.ink, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>{t.prs}</div>
        <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 18, overflow: 'hidden' }}>
          <PRRow v1 name={t.bench} val="82.5" unit={t.kg} reps="5" new />
          <PRRow v1 name={t.squat} val="110" unit={t.kg} reps="3" />
          <PRRow v1 name={t.dl} val="140" unit={t.kg} reps="1" last />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent, good, big, streak, v1 }) {
  const s = V1;
  return (
    <div style={{ background: accent ? s.ink : s.surface, color: accent ? '#fff' : s.ink, border: accent ? 'none' : `1px solid ${s.border}`, borderRadius: 16, padding: 14, minHeight: 82 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: accent ? 'rgba(255,255,255,0.6)' : s.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: accent ? s.accent : s.ink }}>{value}</div>
        {sub && <div style={{ fontSize: 14, fontWeight: 700, color: good ? s.success : streak ? '#EF4444' : (accent ? 'rgba(255,255,255,0.6)' : s.muted) }}>{sub}</div>}
      </div>
    </div>
  );
}

function PRRow({ name, val, unit, reps, new: isNew, last }) {
  const s = V1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: last ? 'none' : `1px solid ${s.border}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: s.ink, letterSpacing: -0.2 }}>{name}</div>
        <div style={{ fontSize: 12, color: s.muted, marginTop: 2, fontWeight: 500 }}>{reps} × reps</div>
      </div>
      {isNew && <div style={{ background: s.accent, color: '#000', fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 4, marginRight: 10, letterSpacing: 0.5 }}>NEW</div>}
      <div style={{ fontSize: 22, fontWeight: 800, color: s.ink, letterSpacing: -0.5 }}>{val}<span style={{ fontSize: 12, fontWeight: 600, color: s.muted, marginLeft: 3 }}>{unit}</span></div>
    </div>
  );
}

// ────────── LOG ──────────
function V1Log() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].log;
  const s = V1;
  const sets = [
    { n: 1, reps: 10, w: 60, rir: 3, done: true },
    { n: 2, reps: 8, w: 70, rir: 2, done: true },
    { n: 3, reps: 8, w: 75, rir: 2, done: true },
    { n: 4, reps: 6, w: 80, rir: 1, done: false, pr: true },
  ];
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, ...V1_STYLE.font }}>
      <div style={{ padding: '18px 20px 8px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: s.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t.date}</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: s.ink, marginTop: 4 }}>{t.title}</div>
      </div>

      {/* Exercise picker */}
      <div style={{ margin: '6px 16px 14px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: s.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t.exercise}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: s.ink, letterSpacing: -0.3, marginTop: 2 }}>{t.chooseExercise}</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: s.pill, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* Input row big */}
      <div style={{ margin: '0 16px 12px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 20, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <NumInput v1 label={t.reps} val="8" />
          <NumInput v1 label={t.weight} val="80" big />
          <NumInput v1 label={t.rir} val="2" />
        </div>
        <button style={{ width: '100%', height: 52, background: s.accent, color: '#000', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Archivo' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t.addSet}
        </button>
      </div>

      {/* logged sets */}
      <div style={{ padding: '4px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: s.ink, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t.logged}</div>
        <div style={{ fontSize: 12, color: s.muted, fontWeight: 600 }}>3 / 4</div>
      </div>
      <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sets.map(set => (
          <SetRow key={set.n} set={set} t={t} />
        ))}
      </div>
    </div>
  );
}

function NumInput({ label, val, big }) {
  const s = V1;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: s.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ background: s.bg, borderRadius: 12, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: big ? 26 : 22, fontWeight: 800, color: s.ink, letterSpacing: -0.5, fontFamily: 'Archivo' }}>{val}</div>
    </div>
  );
}

function SetRow({ set, t }) {
  const s = V1;
  return (
    <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: set.done ? 1 : 1 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: set.done ? s.ink : s.pill, color: set.done ? s.accent : s.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'Archivo', fontSize: 15 }}>{set.n}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: s.ink }}>{set.reps}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: s.muted, textTransform: 'uppercase' }}>×</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: s.ink }}>{set.w}<span style={{ fontSize: 12, color: s.muted, marginLeft: 2 }}>kg</span></span>
        <span style={{ fontSize: 11, fontWeight: 700, color: s.muted, marginLeft: 'auto' }}>RIR {set.rir}</span>
      </div>
      {set.pr && <div style={{ background: s.accent, color: '#000', fontSize: 10, fontWeight: 800, padding: '3px 6px', borderRadius: 4, letterSpacing: 0.5 }}>PR</div>}
      {set.done && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
    </div>
  );
}

// ────────── REST OVERLAY ──────────
function V1Rest() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].rest;
  const s = V1;
  const progress = 0.42;
  const circ = 2 * Math.PI * 92;
  return (
    <div style={{ background: s.ink, height: '100%', position: 'relative', overflow: 'hidden', color: '#fff', ...V1_STYLE.font }}>
      {/* radial glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 40%, ${s.accent}30 0%, transparent 55%)` }} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: s.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 24 }}>{t.title}</div>
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width="220" height="220" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
            <circle cx="100" cy="100" r="92" fill="none" stroke={s.accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -3, lineHeight: 1, color: '#fff', fontFamily: 'Archivo', fontVariantNumeric: 'tabular-nums' }}>0:52</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>of 1:30</div>
          </div>
        </div>
        <div style={{ marginTop: 40, display: 'flex', gap: 10, width: '100%' }}>
          <button style={{ flex: 1, height: 52, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Archivo' }}>{t.skip}</button>
          <button style={{ flex: 1, height: 52, background: s.accent, color: '#000', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Archivo' }}>{t.add}</button>
        </div>
        <div style={{ marginTop: 32, fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Next: Set 5 · 8 × 80 kg</div>
      </div>
    </div>
  );
}

Object.assign(window, { V1, V1Home, V1Log, V1Rest });
