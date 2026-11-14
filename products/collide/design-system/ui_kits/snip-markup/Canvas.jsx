function Canvas({ file, tool, color, onAdd }) {
  const ref = React.useRef(null);
  const [draft, setDraft] = React.useState(null);
  const [size, setSize] = React.useState({ w: 600, h: 392 });
  React.useEffect(() => { const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height })); ro.observe(ref.current); return () => ro.disconnect(); }, []);
  const PT = 72;
  const pt = e => { const r = ref.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = e => { if (!['rect','ellipse','arrow'].includes(tool)) return; const p = pt(e); setDraft({ type: tool, x0: p.x, y0: p.y, x1: p.x, y1: p.y, color }); };
  const move = e => draft && setDraft(d => ({ ...d, ...(() => { const p = pt(e); return { x1: p.x, y1: p.y }; })() }));
  const up = () => { if (draft && (Math.abs(draft.x1 - draft.x0) > 8 || Math.abs(draft.y1 - draft.y0) > 8)) onAdd(draft); setDraft(null); };
  const shape = (m, i) => {
    const x = Math.min(m.x0, m.x1), y = Math.min(m.y0, m.y1), w = Math.abs(m.x1 - m.x0), h = Math.abs(m.y1 - m.y0);
    if (m.type === 'arrow') { const a = Math.atan2(m.y1 - m.y0, m.x1 - m.x0); const hx = m.x1 - 12 * Math.cos(a - 0.45), hy = m.y1 - 12 * Math.sin(a - 0.45), kx = m.x1 - 12 * Math.cos(a + 0.45), ky = m.y1 - 12 * Math.sin(a + 0.45);
      return <svg key={i} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}><path d={`M${m.x0} ${m.y0} L${m.x1} ${m.y1} M${hx} ${hy} L${m.x1} ${m.y1} L${kx} ${ky}`} stroke={m.color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
    return <div key={i} style={{ position: 'absolute', left: x, top: y, width: w, height: h, border: `2px solid ${m.color}`, borderRadius: m.type === 'ellipse' ? '50%' : 4, boxShadow: '0 0 12px -2px rgba(0,0,0,0.6)', pointerEvents: 'none' }} />;
  };
  // callout labels live in the dotted margin above (odd) / below (even) the image, with leader lines
  const callouts = file.marks.map((m, i) => {
    const top = i % 2 === 0;
    const cx = m.type === 'arrow' ? m.x1 : (m.x0 + m.x1) / 2;
    const ty = m.type === 'arrow' ? m.y1 : top ? Math.min(m.y0, m.y1) : Math.max(m.y0, m.y1);
    const left = Math.max(0, Math.min(cx - 60, size.w - 240));
    const ly = top ? PT - 46 : PT + size.h + 18;
    const sx = left + 11, sy = top ? ly + 28 : ly;
    return { m, top, left, ly, sx, sy, tx: cx, ty: ty + PT };
  });
  return <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--pattern-dots), var(--ink-950)', minHeight: 0 }}>
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', placeItems: 'center', padding: '0 28px' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 'min(620px, calc((100vh - 330px) * 1.53))', padding: `${PT}px 0` }}>
        <div ref={ref} onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          style={{ position: 'relative', width: '100%', aspectRatio: '612 / 400', borderRadius: 'var(--radius-md)', background: 'var(--pattern-hatch), var(--surface-1)', boxShadow: 'var(--shadow-3), inset 0 0 0 1px var(--line-2)', cursor: tool === 'select' ? 'default' : 'crosshair', userSelect: 'none' }}>
          <span style={{ position: 'absolute', left: 14, bottom: 12, font: '500 10.5px/1 var(--font-mono)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-4)' }}>Image · {file.label}</span>
          <span style={{ position: 'absolute', right: 14, bottom: 12, font: '400 10.5px/1 var(--font-mono)', color: 'var(--text-4)' }}>{file.dims}</span>
          {file.marks.map((m, i) => shape(m, i))}
          {draft && shape(draft, 'd')}
        </div>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
          {callouts.map((c, i) => { const ky = c.top ? c.sy + 12 : c.sy - 12; const a = Math.atan2(c.ty - ky, c.tx - c.sx), L = 9, s = 0.42;
            const p1 = `${c.tx - L * Math.cos(a - s)} ${c.ty - L * Math.sin(a - s)}`, p2 = `${c.tx - L * Math.cos(a + s)} ${c.ty - L * Math.sin(a + s)}`;
            return <g key={i}>
            <path d={`M${c.sx} ${c.sy} L${c.sx} ${ky} L${c.tx} ${c.ty}`} stroke="var(--steel-400)" strokeWidth="1" fill="none" strokeDasharray="3 3" />
            <path d={`M${p1} L${c.tx} ${c.ty} L${p2} Z`} fill="var(--steel-400)" stroke="var(--steel-400)" strokeWidth="1" strokeLinejoin="round" />
          </g>; })}
        </svg>
        {callouts.map((c, i) => <div key={i} style={{ position: 'absolute', left: c.left, top: c.ly, height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 4px', borderRadius: 999, border: '1px solid transparent', background: 'linear-gradient(var(--glass-fill-strong), var(--glass-fill-strong)) padding-box, var(--glass-border) border-box', backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-2)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <span style={{ width: 20, height: 20, flex: 'none', borderRadius: 999, background: 'var(--steel-500)', color: '#fff', display: 'grid', placeItems: 'center', font: '600 11px/1 var(--font-mono)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>{c.m.n}</span>
          <span style={{ font: '500 12px/1 var(--font-sans)', color: c.m.note ? 'var(--text-1)' : 'var(--text-4)' }}>{c.m.note || 'Untitled callout'}</span>
        </div>)}
      </div>
    </div>
    <div style={{ height: 22, margin: '0 28px 14px', background: 'var(--pattern-ticks)', backgroundRepeat: 'repeat-x', backgroundSize: 'auto 6px', backgroundPosition: '0 bottom', opacity: 0.7 }} />
  </div>;
}
window.Canvas = Canvas;
