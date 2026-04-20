// Variant 2 — DARK ENERGETIC
// Near-black base, vivid amber, chunkier geometric cards, monospace numerals
const V2 = {
  accent: '#FFB020',
  accentDeep: '#FF8A00',
  bg: '#0B0B0E',
  surface: '#16171B',
  surface2: '#1E1F24',
  ink: '#F5F3EE',
  muted: '#8A8B93',
  dim: '#585962',
  border: 'rgba(255,255,255,0.07)',
  success: '#4ADE80',
  danger: '#F43F5E',
};
const V2_STYLE = { font: { fontFamily: 'Archivo, system-ui, sans-serif' } };
const MONO = { fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace' };

function V2Home() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].home;
  const s = V2;
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, color: s.ink, ...V2_STYLE.font }}>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: s.accent, letterSpacing: 2, textTransform: 'uppercase', ...MONO }}>{t.today} · W17.3</div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 8 }}>{t.greeting}</div>
        <div style={{ fontSize: 15, color: s.muted, marginTop: 4, fontWeight: 500 }}>{t.subtitle}</div>
      </div>

      {/* Hero */}
      <div style={{ margin: '6px 16px 16px', background: s.accent, borderRadius: 22, padding: 20, color: '#0A0A0A', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -40, bottom: -60, fontSize: 140, fontWeight: 900, color: 'rgba(0,0,0,0.07)', fontFamily: 'Archivo', lineHeight: 1 }}>06</div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', ...MONO }}>{t.nextUp}</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.8, marginTop: 10, lineHeight: 1.1 }}>{t.upperA}</div>
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)', marginTop: 4, fontWeight: 600 }}>{t.exercises}</div>
          <button style={{ marginTop: 18, width: '100%', height: 52, borderRadius: 14, background: '#0A0A0A', color: s.accent, border: 'none', fontSize: 15, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'Archivo' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={s.accent}><polygon points="5 3 19 12 5 21"/></svg>
            {t.startWorkout}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ padding: '4px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: s.muted, ...MONO }}>{t.week}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: s.dim, ...MONO }}>APR 27 — MAY 3</div>
      </div>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <V2Stat label={t.sets} value="47" delta="+8" />
        <V2Stat label={t.volume} value="12.4" unit="t" />
        <V2Stat label={t.days} value="4/5" highlight />
        <V2Stat label={t.streak} value="12" delta="🔥" />
      </div>

      {/* Coach */}
      <div style={{ margin: '18px 16px 0', background: s.surface, borderRadius: 20, padding: 16, position: 'relative', overflow: 'hidden', border: `1px solid ${s.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: s.accent, color: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16 }}>AI</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: s.accent, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', ...MONO }}>{t.coachTip}</div>
            <div style={{ fontSize: 12, color: s.muted, fontWeight: 600, marginTop: 1 }}>GymBo Coach</div>
          </div>
          <div style={{ fontSize: 11, color: s.dim, fontWeight: 600, ...MONO }}>2m</div>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.45, color: s.ink, fontWeight: 500, marginTop: 12 }}>{t.coachMsg}</div>
        <div style={{ marginTop: 14, padding: '8px 12px', border: `1px solid ${s.accent}55`, borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 8, color: s.accent, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {t.askCoach}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </div>
      </div>

      {/* PR list */}
      <div style={{ padding: '20px 20px 10px', fontSize: 11, fontWeight: 800, color: s.muted, letterSpacing: 1.5, textTransform: 'uppercase', ...MONO }}>{t.prs}</div>
      <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <V2PR name={t.bench} val="82.5" reps="5" new />
        <V2PR name={t.squat} val="110" reps="3" />
        <V2PR name={t.dl} val="140" reps="1" />
      </div>
    </div>
  );
}
function V2Stat({ label, value, unit, delta, highlight }) {
  const s = V2;
  return (
    <div style={{ background: highlight ? s.accent : s.surface, color: highlight ? '#0A0A0A' : s.ink, border: highlight ? 'none' : `1px solid ${s.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: highlight ? 'rgba(0,0,0,0.6)' : s.muted, textTransform: 'uppercase', letterSpacing: 1.2, ...MONO }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: highlight ? 'rgba(0,0,0,0.55)' : s.muted, fontWeight: 700 }}>{unit}</span>}
        {delta && <span style={{ marginLeft: 'auto', fontSize: 12, color: highlight ? '#0A0A0A' : s.success, fontWeight: 800 }}>{delta}</span>}
      </div>
    </div>
  );
}
function V2PR({ name, val, reps, new: isNew }) {
  const s = V2;
  return (
    <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 4, height: 40, background: isNew ? s.accent : s.dim, borderRadius: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: s.ink, letterSpacing: -0.2 }}>{name}</div>
        <div style={{ fontSize: 11, color: s.muted, fontWeight: 700, marginTop: 2, ...MONO }}>{reps} × REPS</div>
      </div>
      {isNew && <div style={{ background: s.accent, color: '#0A0A0A', fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 4, letterSpacing: 0.5 }}>NEW PR</div>}
      <div style={{ fontSize: 22, fontWeight: 800, color: s.ink, letterSpacing: -0.6 }}>{val}<span style={{ fontSize: 11, color: s.muted, marginLeft: 3, fontWeight: 600 }}>kg</span></div>
    </div>
  );
}

function V2Log() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].log;
  const s = V2;
  const sets = [
    { n: 1, reps: 10, w: 60, rir: 3, done: true },
    { n: 2, reps: 8, w: 70, rir: 2, done: true },
    { n: 3, reps: 8, w: 75, rir: 2, done: true },
    { n: 4, reps: 6, w: 80, rir: 1, pr: true },
  ];
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, color: s.ink, ...V2_STYLE.font }}>
      <div style={{ padding: '18px 20px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: s.accent, letterSpacing: 2, textTransform: 'uppercase', ...MONO }}>{t.date}</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, marginTop: 6 }}>{t.title}</div>
      </div>
      <div style={{ margin: '6px 16px 12px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: s.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, ...MONO }}>{t.exercise}</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3, marginTop: 3 }}>{t.chooseExercise}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.muted} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div style={{ margin: '0 16px 12px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 20, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 8, marginBottom: 12 }}>
          <V2Num label={t.reps} val="8" />
          <V2Num label={t.weight} val="80" big />
          <V2Num label={t.rir} val="2" />
        </div>
        <button style={{ width: '100%', height: 52, background: s.accent, color: '#0A0A0A', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Archivo' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t.addSet}
        </button>
      </div>
      <div style={{ padding: '2px 20px 10px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: s.muted, ...MONO }}>{t.logged}</div>
        <div style={{ fontSize: 11, color: s.dim, fontWeight: 700, ...MONO }}>3 / 4</div>
      </div>
      <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sets.map(set => (
          <div key={set.n} style={{ background: s.surface, border: `1px solid ${set.pr ? s.accent : s.border}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: set.done ? s.accent : s.surface2, color: set.done ? '#0A0A0A' : s.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, fontFamily: 'Archivo' }}>{set.n}</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, ...MONO }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: s.ink }}>{set.reps}</span>
              <span style={{ fontSize: 11, color: s.muted, fontWeight: 700 }}>×</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: s.ink }}>{set.w}</span>
              <span style={{ fontSize: 11, color: s.muted, fontWeight: 700 }}>kg</span>
              <span style={{ fontSize: 11, color: s.muted, marginLeft: 'auto', fontWeight: 700 }}>RIR·{set.rir}</span>
            </div>
            {set.pr && <div style={{ background: s.accent, color: '#0A0A0A', fontSize: 10, fontWeight: 800, padding: '3px 6px', borderRadius: 4, letterSpacing: 0.5 }}>PR</div>}
            {set.done && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.success} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
        ))}
      </div>
    </div>
  );
}
function V2Num({ label, val, big }) {
  const s = V2;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: s.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, ...MONO }}>{label}</div>
      <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: big ? 28 : 22, fontWeight: 800, color: big ? s.accent : s.ink, letterSpacing: -0.8, fontFamily: 'Archivo' }}>{val}</div>
    </div>
  );
}

function V2Rest() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].rest;
  const s = V2;
  const progress = 0.42, circ = 2 * Math.PI * 92;
  return (
    <div style={{ background: '#000', height: '100%', position: 'relative', overflow: 'hidden', color: s.ink, ...V2_STYLE.font }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 40%, ${s.accent}40 0%, transparent 60%)` }} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: s.accent, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 28, ...MONO }}>{t.title}</div>
        <div style={{ position: 'relative', width: 240, height: 240 }}>
          <svg width="240" height="240" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"/>
            <circle cx="100" cy="100" r="92" fill="none" stroke={s.accent} strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -3.5, lineHeight: 1, color: s.accent, fontFamily: 'Archivo', fontVariantNumeric: 'tabular-nums' }}>0:52</div>
            <div style={{ fontSize: 11, color: s.muted, fontWeight: 700, marginTop: 10, letterSpacing: 2, textTransform: 'uppercase', ...MONO }}>OF 1:30</div>
          </div>
        </div>
        <div style={{ marginTop: 44, display: 'flex', gap: 10, width: '100%' }}>
          <button style={{ flex: 1, height: 52, background: 'transparent', color: s.ink, border: `1px solid ${s.border}`, borderRadius: 14, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Archivo' }}>{t.skip}</button>
          <button style={{ flex: 1, height: 52, background: s.accent, color: '#0A0A0A', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Archivo' }}>{t.add}</button>
        </div>
        <div style={{ marginTop: 30, fontSize: 12, color: s.muted, fontWeight: 700, letterSpacing: 1, ...MONO }}>NEXT · SET 5 · 8 × 80 KG</div>
      </div>
    </div>
  );
}

Object.assign(window, { V2, V2Home, V2Log, V2Rest, MONO });
