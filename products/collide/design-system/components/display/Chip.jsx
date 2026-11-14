import React from 'react';
import { Icon } from '../display/Icon.jsx';
export function Chip({ children, onRemove, selected, onClick, style }) {
  const [hover, setHover] = React.useState(false);
  return <span onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: onRemove ? '0 6px 0 10px' : '0 10px', borderRadius: 999, background: selected ? 'var(--surface-raised)' : hover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)', boxShadow: `inset 0 0 0 1px ${selected ? 'var(--line-strong)' : 'var(--line-2)'}`, color: 'var(--text-2)', font: '400 12px/1 var(--font-sans)', cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap', ...style }}>
    {children}
    {onRemove && <span onClick={e => { e.stopPropagation(); onRemove(); }} style={{ display: 'grid', placeItems: 'center', width: 16, height: 16, borderRadius: 999, cursor: 'pointer', color: 'var(--text-3)' }}><Icon name="x" size={11} /></span>}
  </span>;
}
