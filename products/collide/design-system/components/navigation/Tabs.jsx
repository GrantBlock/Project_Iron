import React from 'react';
export function Tabs({ items = [], value, onChange, variant = 'segmented', style }) {
  if (variant === 'underline') return <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--line-1)', ...style }}>
    {items.map(it => { const k = it.value ?? it, on = k === value; return <button key={k} onClick={() => onChange && onChange(k)} style={{ background: 'none', border: 0, padding: '10px 0', marginBottom: -1, cursor: 'pointer', borderBottom: `1px solid ${on ? 'var(--accent)' : 'transparent'}`, color: on ? 'var(--text-1)' : 'var(--text-3)', font: '500 13px/1 var(--font-sans)' }}>{it.label ?? it}</button>; })}
  </div>;
  return <div style={{ display: 'inline-flex', padding: 3, gap: 2, borderRadius: 'var(--radius-md)', background: 'var(--ink-950)', boxShadow: 'var(--shadow-inset), inset 0 0 0 1px var(--line-1)', ...style }}>
    {items.map(it => { const k = it.value ?? it, on = k === value; return <button key={k} onClick={() => onChange && onChange(k)} style={{ height: 26, padding: '0 12px', borderRadius: 7, border: '1px solid transparent', cursor: 'pointer', background: on ? 'linear-gradient(var(--surface-raised), var(--surface-raised)) padding-box, var(--glass-border) border-box' : 'transparent', boxShadow: on ? 'var(--shadow-1)' : 'none', color: on ? 'var(--text-1)' : 'var(--text-3)', font: '500 12px/1 var(--font-sans)', transition: 'color var(--dur-1)' }}>{it.label ?? it}</button>; })}
  </div>;
}
