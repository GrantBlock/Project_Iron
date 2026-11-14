import React from 'react';
export function Textarea({ style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return <textarea onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...rest} style={{ width: '100%', boxSizing: 'border-box', minHeight: 72, resize: 'vertical', padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--ink-950)', border: 0, outline: 'none', color: 'var(--text-1)', font: 'var(--type-sm)', boxShadow: focus ? 'inset 0 0 0 1px var(--signal-a40), 0 0 0 3px var(--signal-a08)' : 'var(--shadow-inset), inset 0 0 0 1px var(--line-2)', ...style }} />;
}
