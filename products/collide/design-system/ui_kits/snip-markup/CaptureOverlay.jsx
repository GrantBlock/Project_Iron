function CaptureOverlay({ onCancel, onCapture }) {
  const { Kbd } = window.DS;
  const [r, setR] = React.useState(null);
  const [drag, setDrag] = React.useState(false);
  React.useEffect(() => { const k = e => e.key === 'Escape' && onCancel(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const box = r && { x: Math.min(r.x0, r.x1), y: Math.min(r.y0, r.y1), w: Math.abs(r.x1 - r.x0), h: Math.abs(r.y1 - r.y0) };
  return <div onMouseDown={e => { setDrag(true); setR({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY }); }}
    onMouseMove={e => drag && setR(v => ({ ...v, x1: e.clientX, y1: e.clientY }))}
    onMouseUp={() => { setDrag(false); if (box && box.w > 20 && box.h > 20) onCapture(Math.round(box.w * 1.5), Math.round(box.h * 1.5)); }}
    style={{ position: 'fixed', inset: 0, zIndex: 200, cursor: 'crosshair', userSelect: 'none', background: 'var(--pattern-hatch)' }}>
    {!box && <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,6,7,0.62)' }} />}
    {box && <>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, boxShadow: '0 0 0 100vmax rgba(6,6,7,0.62)', outline: '1px dashed var(--line-dashed)', outlineOffset: -1 }}>
        {[[0,0],[1,0],[0,1],[1,1]].map(([a,b], i) => <span key={i} style={{ position: 'absolute', left: a ? 'calc(100% - 4px)' : -4, top: b ? 'calc(100% - 4px)' : -4, width: 8, height: 8, background: 'var(--ink-50)', borderRadius: 2 }} />)}
      </div>
      <div style={{ position: 'absolute', left: box.x, top: box.y - 28, padding: '5px 7px', borderRadius: 'var(--radius-xs)', background: 'var(--steel-500)', color: '#fff', font: '500 11px/1 var(--font-mono)' }}>{Math.round(box.w * 1.5)} × {Math.round(box.h * 1.5)}</div>
    </>}
    <div style={{ position: 'absolute', left: '50%', bottom: 32, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 999, border: '1px solid transparent', background: 'linear-gradient(var(--glass-fill), var(--glass-fill)) padding-box, var(--glass-border) border-box', backdropFilter: 'blur(24px)', boxShadow: 'var(--shadow-3)', font: '500 10.5px/1 var(--font-mono)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-2)', pointerEvents: 'none' }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />Drag to select
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Kbd>Esc</Kbd>cancel</span>
      <span>Release to crop</span>
    </div>
  </div>;
}
window.CaptureOverlay = CaptureOverlay;
