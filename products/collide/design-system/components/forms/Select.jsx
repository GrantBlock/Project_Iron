import React from 'react';
import { Icon } from '../display/Icon.jsx';
export function Select({ value, onChange, options = [], size = 'md', style }) {
  const h = { sm: 28, md: 34 }[size];
  return <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', height: h, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(var(--surface-3), var(--surface-3)) padding-box, var(--glass-border) border-box', border: '1px solid transparent', boxShadow: 'var(--shadow-1)', ...style }}>
    <select value={value} onChange={e => onChange && onChange(e.target.value)} style={{ appearance: 'none', background: 'transparent', border: 0, outline: 'none', color: 'var(--text-1)', font: '500 13px/1 var(--font-sans)', height: '100%', padding: '0 30px 0 10px', cursor: 'pointer' }}>
      {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <Icon name="chevrons-up-down" size={13} color="var(--text-3)" style={{ position: 'absolute', right: 9, pointerEvents: 'none' }} />
  </label>;
}
