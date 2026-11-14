import React from 'react';
export function Icon({ name, size = 16, color = 'currentColor', style, ...rest }) {
  const url = `url(https://unpkg.com/lucide-static@0.460.0/icons/${name}.svg)`;
  return <span aria-hidden="true" {...rest} style={{ display: 'inline-block', flex: 'none', width: size, height: size, background: color, WebkitMask: `${url} center / contain no-repeat`, mask: `${url} center / contain no-repeat`, ...style }} />;
}
