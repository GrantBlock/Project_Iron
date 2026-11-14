import React from 'react';
import { IconButton } from '../actions/IconButton.jsx';
export function Dialog({ open = true, title, description, children, footer, onClose, width = 440, inline }) {
  if (!open) return null;
  const box = <div role="dialog" style={{ width, maxWidth: '100%', boxSizing: 'border-box', borderRadius: 'var(--radius-xl)', border: '1px solid transparent', background: 'linear-gradient(var(--glass-fill-strong), var(--glass-fill-strong)) padding-box, var(--glass-border) border-box', backdropFilter: 'blur(var(--blur-heavy))', boxShadow: 'var(--shadow-3)', overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 18px 0 20px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ font: 'var(--type-h4)', letterSpacing: '-0.015em', color: 'var(--text-1)' }}>{title}</div>
        {description && <div style={{ font: 'var(--type-sm)', color: 'var(--text-3)', textWrap: 'pretty' }}>{description}</div>}
      </div>
      {onClose && <IconButton icon="x" label="Close" size="sm" onClick={onClose} />}
    </div>
    {children && <div style={{ padding: '16px 20px 0' }}>{children}</div>}
    {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, marginTop: 18, borderTop: '1px solid var(--line-1)', background: 'rgba(0,0,0,0.15)' }}>{footer}</div>}
  </div>;
  if (inline) return box;
  return <div onClick={e => e.target === e.currentTarget && onClose && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', background: 'rgba(6,6,7,0.6)', backdropFilter: 'blur(4px)' }}>{box}</div>;
}
