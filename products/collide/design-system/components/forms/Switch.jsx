import React from 'react';
export function Switch({ checked, onChange, label, disabled }) {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, font: 'var(--type-sm)', color: 'var(--text-2)' }}>
    <span onClick={() => !disabled && onChange && onChange(!checked)} style={{ width: 32, height: 18, borderRadius: 999, position: 'relative', background: checked ? 'var(--accent)' : 'var(--ink-950)', boxShadow: checked ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 0 14px -4px var(--accent)' : 'var(--shadow-inset), inset 0 0 0 1px var(--line-3)', transition: 'background var(--dur-2) var(--ease-out), box-shadow var(--dur-2)' }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14, borderRadius: 999, background: checked ? '#fff' : 'var(--ink-300)', boxShadow: '0 1px 2px rgba(0,0,0,0.5)', transition: 'left var(--dur-2) var(--ease-snap)' }} />
    </span>
    {label}
  </label>;
}
