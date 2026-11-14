import React from 'react';
import { Icon } from '../display/Icon.jsx';
const S = { sm: 28, md: 34, lg: 42 };
export function IconButton({ icon, size = 'md', active, variant = 'ghost', label, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const s = S[size];
  const bg = active ? 'linear-gradient(var(--surface-raised), var(--surface-raised)) padding-box, var(--glass-border) border-box'
    : variant === 'glass' ? `linear-gradient(${hover ? 'var(--surface-raised)' : 'var(--surface-3)'}, ${hover ? 'var(--surface-raised)' : 'var(--surface-3)'}) padding-box, var(--glass-border) border-box`
    : variant === 'solid' ? (hover ? 'var(--ink-100)' : 'var(--ink-50)')
    : hover ? 'rgba(255,255,255,0.06)' : 'transparent';
  return <button aria-label={label} title={label} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...rest}
    style={{ width: s, height: s, display: 'inline-grid', placeItems: 'center', padding: 0, border: '1px solid transparent', borderRadius: variant === 'solid' || variant === 'round' ? 999 : 'var(--radius-sm)', background: bg, color: variant === 'solid' ? 'var(--text-inverse)' : active || hover ? 'var(--text-1)' : 'var(--text-3)', boxShadow: active ? 'var(--shadow-1)' : 'none', cursor: 'pointer', transition: 'background var(--dur-1) var(--ease-out), color var(--dur-1)', ...style }}>
    <Icon name={icon} size={size === 'sm' ? 14 : 16} />
  </button>;
}
