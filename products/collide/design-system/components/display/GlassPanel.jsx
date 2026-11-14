import React from 'react';
export function GlassPanel({ variant = 'solid', radius = 'lg', glow, pattern, padding = 0, children, style, ...rest }) {
  const fill = variant === 'floating' ? 'var(--glass-fill)' : 'var(--glass-fill-strong)';
  const pat = pattern ? `var(--pattern-${pattern}), ` : '';
  return <div {...rest} style={{ position: 'relative', borderRadius: `var(--radius-${radius})`, border: '1px solid transparent', background: `${pat}linear-gradient(${fill}, ${fill}) padding-box, ${glow ? 'var(--glass-border-signal)' : 'var(--glass-border)'} border-box`, backdropFilter: variant === 'floating' ? 'blur(var(--blur-glass)) saturate(140%)' : undefined, WebkitBackdropFilter: variant === 'floating' ? 'blur(var(--blur-glass)) saturate(140%)' : undefined, boxShadow: `${variant === 'floating' ? 'var(--shadow-3)' : 'var(--shadow-2)'}${glow ? ', 0 0 40px -12px rgba(255,61,31,0.5)' : ''}`, padding, boxSizing: 'border-box', ...style }}>{children}</div>;
}
export function PanelHeader({ title, children, style }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 12px', borderBottom: '1px solid var(--line-1)', ...style }}>
    <span style={{ font: '500 10.5px/1 var(--font-mono)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-3)', flex: 1 }}>{title}</span>{children}
  </div>;
}
