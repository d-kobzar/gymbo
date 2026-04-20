// V2 additional screens
function V2Progress() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].progress;
  const s = V2;
  const data = [62, 65, 65, 67.5, 70, 70, 72.5, 75, 75, 77.5, 80, 82.5];
  const max = Math.max(...data), min = Math.min(...data);
  const W = 320, H = 160, PAD = 12;
  const pts = data.map((v, i) => [PAD + (i * (W - PAD*2)) / (data.length-1), H - PAD - ((v-min)/(max-min))*(H-PAD*2)]);
  const path = pts.map((p,i)=> (i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`)).join(' ');
  const bars = [8, 10, 11, 9, 12, 14, 13];
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, color: s.ink, ...V2_STYLE.font }}>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{t.title}</div>
        <div style={{ fontSize: 14, color: s.muted, fontWeight: 500, marginTop: 2 }}>{t.subtitle}</div>
      </div>
      <div style={{ margin: '8px 16px 12px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>Bench press</div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={s.muted} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6 }}>
        {[t.maxWeight, t.maxReps, t.volume].map((m, i) => (
          <div key={i} style={{ padding: '7px 12px', borderRadius: 100, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, background: i===0 ? s.accent : 'transparent', color: i===0 ? '#0A0A0A' : s.muted, border: i===0 ? 'none' : `1px solid ${s.border}` }}>{m}</div>
        ))}
      </div>
      {/* chart */}
      <div style={{ margin: '0 16px 12px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 18, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: s.muted, textTransform: 'uppercase', letterSpacing: 1.2, ...MONO }}>{t.last12}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
              <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.2, color: s.accent }}>82.5</span>
              <span style={{ fontSize: 12, color: s.muted, fontWeight: 700 }}>kg</span>
            </div>
          </div>
          <div style={{ background: `${s.success}20`, color: s.success, borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 800, height: 'fit-content', ...MONO }}>+20.5 KG</div>
        </div>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 8 }}>
          <defs>
            <linearGradient id="v2-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.accent} stopOpacity="0.35"/>
              <stop offset="100%" stopColor={s.accent} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={path + ` L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z`} fill="url(#v2-grad)"/>
          <path d={path} fill="none" stroke={s.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="5" fill={s.accent}/>
          <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="11" fill={s.accent} opacity="0.25"/>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: s.dim, fontWeight: 700, marginTop: 4, ...MONO }}>
          <span>FEB</span><span>MAR</span><span>APR</span>
        </div>
      </div>
      {/* volume bars */}
      <div style={{ padding: '4px 20px 10px', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: s.muted, ...MONO }}>WEEKLY VOLUME</div>
      <div style={{ margin: '0 16px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 16, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
          {bars.map((h, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: '100%', height: h*5, background: i===bars.length-1 ? s.accent : s.surface2, borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {['W11','W12','W13','W14','W15','W16','W17'].map((w, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: s.dim, fontWeight: 700, ...MONO }}>{w}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function V2Program() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].program;
  const s = V2;
  const days = [
    { day: t.mon, name: t.upperA, ex: ['Bench','OHP','Row','Triceps'] },
    { day: t.tue, name: t.lowerA, ex: ['Squat','RDL','Leg curl','Calves'] },
    { day: t.wed, rest: true },
    { day: t.thu, name: t.upperB, ex: ['Incline','Pull-up','Lateral','Curl'] },
    { day: t.fri, name: t.lowerB, ex: ['Deadlift','Lunge','Hip thrust'] },
    { day: t.sat, rest: true },
    { day: t.sun, rest: true },
  ];
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 30, color: s.ink, ...V2_STYLE.font }}>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{t.title}</div>
        <div style={{ fontSize: 14, color: s.muted, fontWeight: 500, marginTop: 2 }}>{t.subtitle}</div>
      </div>
      <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: s.accent, ...MONO }}>{t.week} 3</div>
        <div style={{ fontSize: 11, color: s.muted, fontWeight: 700, ...MONO }}>APR 27 — MAY 3</div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {days.map((d, i) => (
          <div key={i} style={{ background: d.rest ? 'transparent' : s.surface, border: d.rest ? `1px dashed ${s.border}` : `1px solid ${s.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: s.muted, textTransform: 'uppercase', letterSpacing: 1, ...MONO }}>{d.day}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: d.rest ? s.dim : s.ink, letterSpacing: -0.5, marginTop: 2 }}>{27+i}</div>
            </div>
            <div style={{ width: 1, height: 36, background: s.border }} />
            {d.rest ? (
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: s.dim, textTransform: 'uppercase', letterSpacing: 1, ...MONO }}>{t.rest}</div>
            ) : (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: s.ink, letterSpacing: -0.2 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: s.muted, marginTop: 3, fontWeight: 600, ...MONO }}>{d.ex.join(' · ').toUpperCase()}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function V2Coach() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].coach;
  const s = V2;
  return (
    <div style={{ background: s.bg, height: '100%', display: 'flex', flexDirection: 'column', color: s.ink, ...V2_STYLE.font }}>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: s.accent, color: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>AI</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>{t.title}</div>
            <div style={{ fontSize: 11, color: s.success, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, ...MONO }}>● ONLINE</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <V2Bubble ai>{t.welcome}</V2Bubble>
        <V2Bubble>{t.q1}</V2Bubble>
        <V2Bubble ai>{t.a1}</V2Bubble>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {['📊 Объём', '🏋️ План', '🔥 Разминка'].map((x, i) => (
            <div key={i} style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 100, padding: '7px 12px', fontSize: 12, fontWeight: 600 }}>{x}</div>
          ))}
        </div>
      </div>
      <div style={{ padding: '10px 14px 90px', display: 'flex', gap: 8, background: s.bg, borderTop: `1px solid ${s.border}` }}>
        <div style={{ flex: 1, background: s.surface, border: `1px solid ${s.border}`, borderRadius: 100, height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 14, color: s.dim, fontWeight: 500 }}>{t.placeholder}</div>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: s.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </div>
      </div>
    </div>
  );
}
function V2Bubble({ children, ai }) {
  const s = V2;
  return (
    <div style={{ alignSelf: ai ? 'flex-start' : 'flex-end', maxWidth: '82%', background: ai ? s.surface : s.accent, color: ai ? s.ink : '#0A0A0A', border: ai ? `1px solid ${s.border}` : 'none', padding: '10px 14px', borderRadius: 18, borderBottomLeftRadius: ai ? 6 : 18, borderBottomRightRadius: ai ? 18 : 6, fontSize: 14, lineHeight: 1.45, fontWeight: 500 }}>{children}</div>
  );
}

function V2Measure() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].measure;
  const s = V2;
  const fields = [
    { k: t.chest, v: '104' }, { k: t.waist, v: '82' },
    { k: t.arm, v: '38' }, { k: t.thigh, v: '59' },
    { k: t.hips, v: '98' }, { k: 'Shoulders', v: '128' },
  ];
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, color: s.ink, ...V2_STYLE.font }}>
      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{t.title}</div>
        <div style={{ fontSize: 14, color: s.muted, fontWeight: 500, marginTop: 2 }}>{t.subtitle}</div>
      </div>
      <div style={{ margin: '6px 16px 12px', background: s.accent, color: '#0A0A0A', borderRadius: 20, padding: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -20, bottom: -40, fontSize: 120, fontWeight: 900, color: 'rgba(0,0,0,0.07)', lineHeight: 1 }}>W</div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, ...MONO }}>{t.weight}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1 }}>78.4</span>
            <span style={{ fontSize: 16, color: 'rgba(0,0,0,0.55)', fontWeight: 700 }}>kg</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, ...MONO }}>−0.6 ↓</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {fields.map((f, i) => (
          <div key={i} style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, color: s.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, ...MONO }}>{f.k}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: s.ink, letterSpacing: -0.6 }}>{f.v}</span>
              <span style={{ fontSize: 11, color: s.muted, fontWeight: 700 }}>cm</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '18px 20px 10px', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: s.muted, ...MONO }}>{t.photos}</div>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[t.front, t.side, t.back].map((p, i) => (
          <div key={i} style={{ aspectRatio: '3/4', background: s.surface, border: `1.5px dashed ${s.border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: s.muted }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, ...MONO }}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function V2Exercises() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].exercises;
  const s = V2;
  const items = [
    { name: 'Bench press', cat: t.chest, sets: 142 },
    { name: 'Incline dumbbell press', cat: t.chest, sets: 86 },
    { name: 'Squat', cat: t.legs, sets: 110 },
    { name: 'Deadlift', cat: t.back, sets: 64 },
    { name: 'Pull-up', cat: t.back, sets: 52 },
    { name: 'Overhead press', cat: t.shoulders, sets: 48 },
  ];
  const cats = [t.all, t.chest, t.back, t.legs, t.shoulders, t.arms];
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, color: s.ink, ...V2_STYLE.font }}>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{t.title}</div>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span style={{ fontSize: 14, color: s.dim, fontWeight: 500 }}>{t.search}</span>
        </div>
      </div>
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {cats.map((c, i) => (
          <div key={i} style={{ padding: '7px 12px', borderRadius: 100, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, background: i === 0 ? s.accent : 'transparent', color: i === 0 ? '#0A0A0A' : s.muted, border: i === 0 ? 'none' : `1px solid ${s.border}` }}>{c}</div>
        ))}
      </div>
      <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: s.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.accent, fontWeight: 800, fontSize: 14, fontFamily: 'Archivo' }}>{it.name.charAt(0)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.ink, letterSpacing: -0.2 }}>{it.name}</div>
              <div style={{ fontSize: 10, color: s.muted, marginTop: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, ...MONO }}>{it.cat} · {it.sets} SETS</div>
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke={s.dim} strokeWidth="2.3" strokeLinecap="round"><path d="M1 1l6 6-6 6"/></svg>
          </div>
        ))}
      </div>
    </div>
  );
}

function V2More() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].more;
  const s = V2;
  const items = [
    { label: t.program, sub: 'PPL · 4 days', icon: 'cal' },
    { label: t.measure, sub: 'Weekly check-in', icon: 'body' },
    { label: t.exercises, sub: '48 in library', icon: 'list' },
    { label: t.coach, sub: 'AI assistant', icon: 'bot' },
    { label: t.settings, sub: null, icon: 'gear' },
  ];
  const iconFor = (n) => {
    const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
    if (n === 'cal') return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    if (n === 'body') return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>;
    if (n === 'list') return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>;
    if (n === 'bot') return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><rect x="3" y="8" width="18" height="12" rx="3"/><line x1="12" y1="3" x2="12" y2="8"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>;
    return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>;
  };
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, color: s.ink, ...V2_STYLE.font }}>
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{t.title}</div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: s.surface2, color: s.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{iconFor(it.icon)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.ink, letterSpacing: -0.2 }}>{it.label}</div>
              {it.sub && <div style={{ fontSize: 10, color: s.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, ...MONO }}>{it.sub}</div>}
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke={s.dim} strokeWidth="2.3" strokeLinecap="round"><path d="M1 1l6 6-6 6"/></svg>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 32, fontSize: 10, color: s.dim, fontWeight: 700, letterSpacing: 2, ...MONO }}>GYMBO · V2.0</div>
    </div>
  );
}

function V2Settings() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].settings;
  const s = V2;
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, color: s.ink, ...V2_STYLE.font }}>
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{t.title}</div>
      </div>
      <div style={{ padding: '0 20px 8px', fontSize: 10, fontWeight: 800, color: s.muted, letterSpacing: 1.5, textTransform: 'uppercase', ...MONO }}>{t.lang}</div>
      <div style={{ margin: '0 16px 16px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, padding: 5, display: 'flex', gap: 4 }}>
        {['EN', 'UA', 'RU'].map((l, i) => (
          <div key={l} style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: i===2 ? s.accent : 'transparent', color: i===2 ? '#0A0A0A' : s.muted, borderRadius: 10, fontSize: 12, fontWeight: 800, letterSpacing: 1, ...MONO }}>{l}</div>
        ))}
      </div>
      <div style={{ padding: '0 20px 8px', fontSize: 10, fontWeight: 800, color: s.muted, letterSpacing: 1.5, textTransform: 'uppercase', ...MONO }}>{t.notif}</div>
      <div style={{ margin: '0 16px 16px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <V2SettingRow label={t.reminder} toggle on />
        <V2SettingRow label={t.time} value="18:00" />
        <V2SettingRow label={t.summary} toggle last />
      </div>
      <div style={{ padding: '0 20px 8px', fontSize: 10, fontWeight: 800, color: s.muted, letterSpacing: 1.5, textTransform: 'uppercase', ...MONO }}>{t.data}</div>
      <div style={{ margin: '0 16px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <V2SettingRow label={t.import} action="JSON" />
        <V2SettingRow label={t.export} action="JSON" last />
      </div>
    </div>
  );
}
function V2SettingRow({ label, toggle, on, value, action, last }) {
  const s = V2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: last ? 'none' : `1px solid ${s.border}`, minHeight: 50 }}>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: s.ink }}>{label}</div>
      {toggle && (
        <div style={{ width: 44, height: 26, borderRadius: 13, background: on ? s.accent : s.surface2, position: 'relative', transition: '0.2s' }}>
          <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 22, height: 22, borderRadius: 11, background: on ? '#0A0A0A' : s.muted }} />
        </div>
      )}
      {value && <div style={{ fontSize: 13, fontWeight: 800, color: s.accent, ...MONO }}>{value}</div>}
      {action && <div style={{ padding: '5px 11px', background: s.accent, color: '#0A0A0A', borderRadius: 8, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, ...MONO }}>{action}</div>}
    </div>
  );
}

Object.assign(window, { V2Progress, V2Program, V2Coach, V2Measure, V2Exercises, V2More, V2Settings });
