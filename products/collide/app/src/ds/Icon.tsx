import type { CSSProperties, HTMLAttributes } from "react";
import { ICON_URLS } from "./icons";

// Ported from design-system/components/display/Icon.jsx. Lucide glyphs load as CSS masks
// bundled from lucide-static@0.460.0 (see icons.ts) so they inherit currentColor and work offline.
export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, color = "currentColor", style, ...rest }: IconProps) {
  const url = `url("${ICON_URLS[name] ?? ""}")`;
  return (
    <span
      aria-hidden="true"
      {...rest}
      style={{
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        background: color,
        WebkitMask: `${url} center / contain no-repeat`,
        mask: `${url} center / contain no-repeat`,
        ...style,
      }}
    />
  );
}
