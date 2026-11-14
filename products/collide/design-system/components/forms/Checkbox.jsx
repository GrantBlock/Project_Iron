import React from 'react';
import { Icon } from '../display/Icon.jsx';
export function Checkbox({ checked, onChange, label, disabled }) {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, font: 'var(--type-sm)', color: 'var(--text-2)' }}>
    <span onClick={() => !disabled && onChange && onChange(!checked)} style={{ width: 16, height: 16, borderRadius: 'var(--radius-xs)', display: 'grid', placeItems: 'center', background: checked ? 'var(--accent)' : 'var(--ink-950)', boxShadow: checked ? 'inset 0 1px 0 rgba(255,255,255,0.25)' : 'inset 0 0 0 1px var(--line-3)', color: '#fff', transition: 'background var(--dur-1)' }}>{checked && <Icon name="check" size={12} />}</span>
    {label}
  </label>;
}
