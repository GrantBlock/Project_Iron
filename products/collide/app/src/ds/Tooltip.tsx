import { useState } from "react";
import type { ReactNode } from "react";
import { Kbd } from "./Kbd";

// Ported from design-system/components/feedback/Tooltip.jsx.
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
  const show = open ?? hover;
  const pos = placement === "top" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" };
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: "inline-flex" }}
    >
      {children}
      <span
        role="tooltip"
        style={{
          position: "absolute",
          left: "50%",
          ...pos,
          transform: `translateX(-50%) translateY(${show ? 0 : placement === "top" ? 4 : -4}px)`,
          opacity: show ? 1 : 0,
          pointerEvents: "none",
          transition: "opacity var(--dur-1) var(--ease-out), transform var(--dur-2) var(--ease-out)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          whiteSpace: "nowrap",
          borderRadius: "var(--radius-sm)",
          border: "1px solid transparent",
          background: "linear-gradient(var(--ink-700), var(--ink-700)) padding-box, var(--glass-border) border-box",
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
    </span>
  );
}
