import type { CSSProperties, ReactNode } from "react";

// Ported from design-system/components/display/Kbd.jsx.
export function Kbd({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <kbd
      style={{
        display: "inline-grid",
        placeItems: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        boxSizing: "border-box",
        borderRadius: 4,
        background: "var(--surface-3)",
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.5), inset 0 0 0 1px var(--line-2)",
        color: "var(--text-2)",
        font: "500 10.5px/1 var(--font-mono)",
        ...style,
      }}
    >
      {children}
    </kbd>
  );
}
