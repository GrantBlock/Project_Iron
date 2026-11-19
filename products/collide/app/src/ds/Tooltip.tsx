import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Kbd } from "./Kbd";

// Ported from design-system/components/feedback/Tooltip.jsx. T45 (6.1): the tip is drawn only while shown, and fixed to
// the window at its anchor, so a hidden tip never makes the toolbar scroll and a shown one is not cut off by it.
export function Tooltip({
  label,
  shortcut,
  children,
  placement = "bottom",
  open,
}: {
  label: string;
  shortcut?: string;
  children: ReactNode;
  placement?: "top" | "bottom";
  open?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const show = open ?? hover;
  const r = show ? anchor.current?.getBoundingClientRect() : undefined;
  const pos = !r
    ? { top: 0, left: 0 }
    : placement === "top"
      ? { top: r.top - 8, left: r.left + r.width / 2 }
      : { top: r.bottom + 8, left: r.left + r.width / 2 };
  return (
    <span
      ref={anchor}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: "inline-flex" }}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          style={{
            position: "fixed",
            ...pos,
            transform: `translateX(-50%)${placement === "top" ? " translateY(-100%)" : ""}`,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            whiteSpace: "nowrap",
            borderRadius: "var(--radius-sm)",
            border: "1px solid transparent",
            background:
              "linear-gradient(var(--ink-700), var(--ink-700)) padding-box, var(--glass-border) border-box",
            boxShadow: "var(--shadow-2)",
            font: "500 12px/1 var(--font-sans)",
            color: "var(--text-1)",
            zIndex: 50,
          }}
        >
          {label}
          {shortcut && (
            <span style={{ display: "flex", gap: 3 }}>
              {shortcut.split("+").map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
