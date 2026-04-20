// Telegram Mini App frame — iOS device + TG header
function TGHeader({ title = 'GymBo', dark = false }) {
  const bg = dark ? '#17212b' : '#ffffff';
  const text = dark ? '#ffffff' : '#000000';
  const sub = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const divider = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <div style={{ background: bg, paddingTop: 54, borderBottom: `0.5px solid ${divider}`, position: 'relative', zIndex: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3390ec', fontSize: 17, fontWeight: 400, fontFamily: '-apple-system,system-ui', cursor: 'pointer' }}>
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none"><path d="M10 1L2 9l8 8" stroke="#3390ec" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span>Close</span>
        </div>
        <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: text, fontFamily: 'Archivo,system-ui', letterSpacing: -0.1 }}>{title}</div>
          <div style={{ fontSize: 12, color: sub, fontFamily: '-apple-system,system-ui' }}>mini app · bot</div>
        </div>
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="22" height="5" viewBox="0 0 22 5"><circle cx="2.5" cy="2.5" r="2" fill={text} opacity="0.55"/><circle cx="11" cy="2.5" r="2" fill={text} opacity="0.55"/><circle cx="19.5" cy="2.5" r="2" fill={text} opacity="0.55"/></svg>
        </div>
      </div>
    </div>
  );
}

function TGFrame({ children, title = 'GymBo', dark = false, width = 390, height = 780, bg }) {
  const screenBg = bg || (dark ? '#0f1115' : '#f5f5f2');
  return (
    <div style={{
      width, height, borderRadius: 48, overflow: 'hidden', position: 'relative',
      background: '#000',
      boxShadow: '0 30px 70px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.15)',
      fontFamily: 'Archivo, -apple-system, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* dynamic island */}
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 120, height: 34, borderRadius: 22, background: '#000', zIndex: 50 }} />
      {/* iOS status bar area, baked into TG header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, padding: '17px 30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: '-apple-system,"SF Pro",system-ui', fontWeight: 590, fontSize: 15, color: dark ? '#fff' : '#000' }}>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="17" height="11" viewBox="0 0 19 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={dark ? '#fff' : '#000'}/><rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={dark ? '#fff' : '#000'}/><rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={dark ? '#fff' : '#000'}/><rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={dark ? '#fff' : '#000'}/></svg>
          <svg width="15" height="11" viewBox="0 0 17 12"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill={dark ? '#fff' : '#000'}/><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill={dark ? '#fff' : '#000'}/><circle cx="8.5" cy="10.5" r="1.5" fill={dark ? '#fff' : '#000'}/></svg>
          <svg width="25" height="12" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={dark ? '#fff' : '#000'} strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="17" height="9" rx="2" fill={dark ? '#fff' : '#000'}/></svg>
        </div>
      </div>

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: screenBg }}>
        <TGHeader title={title} dark={dark} />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>{children}</div>
      </div>

      {/* home indicator */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60, height: 30, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 8, pointerEvents: 'none' }}>
        <div style={{ width: 130, height: 5, borderRadius: 100, background: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.3)' }} />
      </div>
    </div>
  );
}

// Bottom tab bar (shared)
function TabBar({ active = 'home', dark = false, accent = '#FF4D2E' }) {
  const t = window.GYMBO_I18N[window.GYMBO_LANG || 'ru'].nav;
  const tabs = [
    { id: 'home', label: t.home, icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/> },
    { id: 'log', label: t.log, icon: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></> },
    { id: 'progress', label: t.progress, icon: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></> },
    { id: 'more', label: t.more, icon: <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></> },
  ];
  const bg = dark ? 'rgba(15,17,21,0.9)' : 'rgba(255,255,255,0.92)';
  const dim = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: bg, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      borderTop: `0.5px solid ${border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      height: 72, paddingBottom: 18, zIndex: 20,
    }}>
      {tabs.map(tab => {
        const isActive = tab.id === active;
        return (
          <div key={tab.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isActive ? accent : dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{tab.icon}</svg>
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500, color: isActive ? accent : dim, fontFamily: 'Archivo,system-ui', letterSpacing: 0.1, textTransform: 'uppercase' }}>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { TGFrame, TabBar });
