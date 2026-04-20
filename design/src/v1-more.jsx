// Variant 1 — remaining screens: Progress, Program, Measure, Exercises, Coach, More, Settings
function V1Progress() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].progress;
  const s = V1;
  // Sample line chart data (12 points, growing trend)
  const data = [62, 65, 65, 67.5, 70, 70, 72.5, 75, 75, 77.5, 80, 82.5];
  const max = Math.max(...data), min = Math.min(...data);
  const W = 320, H = 170, PAD = 12;
  const pts = data.map((v, i) => [
    PAD + (i * (W - PAD * 2)) / (data.length - 1),
    H - PAD - ((v - min) / (max - min)) * (H - PAD * 2),
  ]);
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = path + ` L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z`;
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, ...V1_STYLE.font }}>
      <div style={{ padding: '18px 20px 8px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: s.ink }}>{t.title}</div>
        <div style={{ fontSize: 14, color: s.muted, fontWeight: 500, marginTop: 2 }}>{t.subtitle}</div>
      </div>

      {/* exercise picker */}
      <div style={{ margin: '10px 16px 14px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: s.ink }}>Bench press</div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={s.muted} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {/* metric chips */}
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
        {[t.maxWeight, t.maxReps, t.volume].map((m, i) => (
          <div key={i} style={{
            padding: '8px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
            background: i === 0 ? s.ink : 'transparent', color: i === 0 ? s.accent : s.muted, border: i === 0 ? 'none' : `1px solid ${s.border}`,
          }}>{m}</div>
        ))}
      </div>

      {/* Chart card */}
      <div style={{ margin: '0 16px 14px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 20, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t.last12}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, color: s.ink, fontFamily: 'Archivo' }}>82.5</span>
              <span style={{ fontSize: 13, color: s.muted, fontWeight: 600 }}>kg</span>
            </div>
          </div>
          <div style={{ background: '#DCFCE7', color: '#166534', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 800 }}>+20 kg</div>
        </div>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 4 }}>
          <defs>
            <linearGradient id="v1-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.accent} stopOpacity="0.28"/>
              <stop offset="100%" stopColor={s.accent} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={area} fill="url(#v1-grad)"/>
          <path d={path} fill="none" stroke={s.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          {pts.map((p, i) => i === pts.length - 1 && (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r="5" fill={s.accent}/>
              <circle cx={p[0]} cy={p[1]} r="10" fill={s.accent} opacity="0.2"/>
            </g>
          ))}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: s.dim, fontWeight: 600, marginTop: 6 }}>
          <span>Feb</span><span>Mar</span><span>Apr</span>
        </div>
      </div>

      {/* PR cards */}
      <div style={{ padding: '4px 20px 10px', fontSize: 11, fontWeight: 800, color: s.ink, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t.trend}</div>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 11, color: s.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.pr}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.8, color: s.ink, marginTop: 4 }}>82.5<span style={{ fontSize: 12, color: s.muted, marginLeft: 3 }}>kg × 5</span></div>
        </div>
        <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 11, color: s.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.est}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.8, color: s.ink, marginTop: 4 }}>96<span style={{ fontSize: 12, color: s.muted, marginLeft: 3 }}>kg</span></div>
        </div>
      </div>
    </div>
  );
}

function V1Program() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].program;
  const s = V1;
  const days = [
    { day: t.mon, name: t.upperA, ex: ['Bench', 'OHP', 'Row', 'Triceps'], color: s.accent },
    { day: t.tue, name: t.lowerA, ex: ['Squat', 'RDL', 'Leg curl', 'Calves'], color: '#0A0A0A' },
    { day: t.wed, name: null, rest: true },
    { day: t.thu, name: t.upperB, ex: ['Incline', 'Pull-up', 'Lateral', 'Curl'], color: s.accent },
    { day: t.fri, name: t.lowerB, ex: ['Deadlift', 'Lunge', 'Hip thrust'], color: '#0A0A0A' },
    { day: t.sat, name: null, rest: true },
    { day: t.sun, name: null, rest: true },
  ];
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 30, ...V1_STYLE.font }}>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: s.ink }}>{t.title}</div>
        <div style={{ fontSize: 14, color: s.muted, fontWeight: 500, marginTop: 2 }}>{t.subtitle}</div>
      </div>
      <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: s.ink, textTransform: 'uppercase', letterSpacing: 1.2 }}>{t.week} 3</div>
        <div style={{ fontSize: 11, color: s.muted, fontWeight: 600 }}>APR 27 — MAY 3</div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {days.map((d, i) => (
          <div key={i} style={{
            background: d.rest ? 'transparent' : s.surface, border: d.rest ? `1px dashed ${s.border}` : `1px solid ${s.border}`,
            borderRadius: 16, padding: d.rest ? '12px 16px' : '14px 16px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: s.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{d.day}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.ink, letterSpacing: -0.5, marginTop: 2 }}>{27 + i}</div>
            </div>
            <div style={{ width: 1, height: 36, background: s.border }} />
            {d.rest ? (
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: s.dim, fontStyle: 'italic' }}>{t.rest}</div>
            ) : (
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 4, height: 4, borderRadius: 2, background: d.color }} />
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.ink, letterSpacing: -0.2 }}>{d.name}</div>
                </div>
                <div style={{ fontSize: 12, color: s.muted, marginTop: 4, fontWeight: 500 }}>{d.ex.join(' · ')}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function V1More() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].more;
  const s = V1;
  const items = [
    { icon: 'calendar', label: t.program, color: s.accent },
    { icon: 'body', label: t.measure, color: '#16A34A' },
    { icon: 'list', label: t.exercises, color: '#3B82F6' },
    { icon: 'bot', label: t.coach, color: '#A855F7' },
    { icon: 'gear', label: t.settings, color: s.muted },
  ];
  const iconFor = (n) => {
    const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
    if (n === 'calendar') return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    if (n === 'body') return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>;
    if (n === 'list') return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>;
    if (n === 'bot') return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><rect x="3" y="8" width="18" height="12" rx="3"/><line x1="12" y1="3" x2="12" y2="8"/><circle cx="12" cy="3" r="1"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>;
    return <svg width="20" height="20" viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  };
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, ...V1_STYLE.font }}>
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: s.ink }}>{t.title}</div>
      </div>
      <div style={{ margin: '0 16px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 18, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 14, borderBottom: i === items.length - 1 ? 'none' : `1px solid ${s.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${it.color}18`, color: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{iconFor(it.icon)}</div>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: s.ink, letterSpacing: -0.2 }}>{it.label}</div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke={s.dim} strokeWidth="2.3" strokeLinecap="round"><path d="M1 1l6 6-6 6"/></svg>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: s.dim, fontWeight: 600, letterSpacing: 1 }}>GYMBO · V2.0</div>
    </div>
  );
}

function V1Coach() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].coach;
  const s = V1;
  return (
    <div style={{ background: s.bg, height: '100%', display: 'flex', flexDirection: 'column', ...V1_STYLE.font }}>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: s.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.accent, fontWeight: 900, fontSize: 17, fontFamily: 'Archivo' }}>AI</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4, color: s.ink }}>{t.title}</div>
            <div style={{ fontSize: 12, color: s.success, fontWeight: 600 }}>● online</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Bubble ai>{t.welcome}</Bubble>
        <Bubble>{t.q1}</Bubble>
        <Bubble ai>{t.a1}</Bubble>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {['📊 Мой объём', '🏋️ План на неделю', '🔥 Разминка'].map((x, i) => (
            <div key={i} style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 100, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: s.ink }}>{x}</div>
          ))}
        </div>
      </div>
      <div style={{ padding: '10px 14px 90px', display: 'flex', gap: 8, background: s.bg, borderTop: `1px solid ${s.border}` }}>
        <div style={{ flex: 1, background: s.surface, border: `1px solid ${s.border}`, borderRadius: 100, height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 14, color: s.dim, fontWeight: 500 }}>{t.placeholder}</div>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: s.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </div>
      </div>
    </div>
  );
}
function Bubble({ children, ai }) {
  const s = V1;
  return (
    <div style={{
      alignSelf: ai ? 'flex-start' : 'flex-end',
      maxWidth: '82%',
      background: ai ? s.surface : s.ink, color: ai ? s.ink : '#fff',
      border: ai ? `1px solid ${s.border}` : 'none',
      padding: '10px 14px', borderRadius: 18,
      borderBottomLeftRadius: ai ? 6 : 18, borderBottomRightRadius: ai ? 18 : 6,
      fontSize: 14, lineHeight: 1.45, fontWeight: 500,
    }}>{children}</div>
  );
}

function V1Measure() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].measure;
  const s = V1;
  const fields = [
    { k: t.weight, v: '78.4', u: 'kg', hero: true },
    { k: t.chest, v: '104', u: 'cm' },
    { k: t.waist, v: '82', u: 'cm' },
    { k: t.arm, v: '38', u: 'cm' },
    { k: t.thigh, v: '59', u: 'cm' },
    { k: t.hips, v: '98', u: 'cm' },
  ];
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, ...V1_STYLE.font }}>
      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: s.ink }}>{t.title}</div>
        <div style={{ fontSize: 14, color: s.muted, fontWeight: 500, marginTop: 2 }}>{t.subtitle}</div>
      </div>
      {/* big weight */}
      <div style={{ margin: '6px 16px 12px', background: s.ink, color: '#fff', borderRadius: 20, padding: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{t.weight}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: -2.5, color: s.accent, lineHeight: 1, fontFamily: 'Archivo' }}>78.4</span>
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>kg</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#86efac' }}>−0.6 kg ↓</span>
        </div>
      </div>
      {/* grid of measurements */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {fields.slice(1).map((f, i) => (
          <div key={i} style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11, color: s.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{f.k}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.ink, letterSpacing: -0.6 }}>{f.v}</span>
              <span style={{ fontSize: 11, color: s.muted, fontWeight: 600 }}>{f.u}</span>
            </div>
          </div>
        ))}
      </div>
      {/* photos */}
      <div style={{ padding: '18px 20px 10px', fontSize: 11, fontWeight: 800, color: s.ink, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t.photos}</div>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[t.front, t.side, t.back].map((p, i) => (
          <div key={i} style={{ aspectRatio: '3/4', background: s.surface, border: `1.5px dashed ${s.border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: s.dim }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function V1Exercises() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].exercises;
  const s = V1;
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
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, ...V1_STYLE.font }}>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: s.ink }}>{t.title}</div>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span style={{ fontSize: 14, color: s.dim, fontWeight: 500 }}>{t.search}</span>
        </div>
      </div>
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {cats.map((c, i) => (
          <div key={i} style={{ padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, background: i === 0 ? s.ink : 'transparent', color: i === 0 ? s.accent : s.muted, border: i === 0 ? 'none' : `1px solid ${s.border}` }}>{c}</div>
        ))}
      </div>
      <div style={{ margin: '0 16px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 18, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: i === items.length - 1 ? 'none' : `1px solid ${s.border}`, gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.pill, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.muted, fontWeight: 800, fontSize: 13, fontFamily: 'Archivo' }}>{it.name.charAt(0)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.ink, letterSpacing: -0.2 }}>{it.name}</div>
              <div style={{ fontSize: 12, color: s.muted, marginTop: 2, fontWeight: 500 }}>{it.cat} · {it.sets} sets</div>
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke={s.dim} strokeWidth="2.3" strokeLinecap="round"><path d="M1 1l6 6-6 6"/></svg>
          </div>
        ))}
      </div>
    </div>
  );
}

function V1Settings() {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].settings;
  const s = V1;
  return (
    <div style={{ background: s.bg, height: '100%', overflow: 'auto', paddingBottom: 80, ...V1_STYLE.font }}>
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: s.ink }}>{t.title}</div>
      </div>
      <div style={{ padding: '0 20px 8px', fontSize: 11, fontWeight: 800, color: s.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t.lang}</div>
      <div style={{ margin: '0 16px 16px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14, padding: 6, display: 'flex', gap: 4 }}>
        {['EN', 'UA', 'RU'].map((l, i) => (
          <div key={l} style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: i === 2 ? s.ink : 'transparent', color: i === 2 ? s.accent : s.muted, borderRadius: 10, fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>{l}</div>
        ))}
      </div>
      <div style={{ padding: '0 20px 8px', fontSize: 11, fontWeight: 800, color: s.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t.notif}</div>
      <div style={{ margin: '0 16px 16px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 18, overflow: 'hidden' }}>
        <SettingRow label={t.reminder} toggle on />
        <SettingRow label={t.time} value="18:00" />
        <SettingRow label={t.summary} toggle last />
      </div>
      <div style={{ padding: '0 20px 8px', fontSize: 11, fontWeight: 800, color: s.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t.data}</div>
      <div style={{ margin: '0 16px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 18, overflow: 'hidden' }}>
        <SettingRow label={t.import} action="JSON" />
        <SettingRow label={t.export} action="JSON" last />
      </div>
    </div>
  );
}
function SettingRow({ label, toggle, on, value, action, last }) {
  const s = V1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: last ? 'none' : `1px solid ${s.border}`, minHeight: 50 }}>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: s.ink }}>{label}</div>
      {toggle && (
        <div style={{ width: 44, height: 26, borderRadius: 13, background: on ? s.accent : '#D4D0C8', position: 'relative', transition: '0.2s' }}>
          <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </div>
      )}
      {value && <div style={{ fontSize: 14, fontWeight: 700, color: s.muted }}>{value}</div>}
      {action && <div style={{ padding: '6px 12px', background: s.ink, color: s.accent, borderRadius: 8, fontSize: 12, fontWeight: 800 }}>{action}</div>}
    </div>
  );
}

Object.assign(window, { V1Progress, V1Program, V1More, V1Coach, V1Measure, V1Exercises, V1Settings });
