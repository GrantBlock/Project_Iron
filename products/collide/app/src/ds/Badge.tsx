import type { CSSProperties, ReactNode } from "react";

// Ported from design-system/components/display/Badge.jsx.
const T = {
  neutral: ["var(--text-2)", "rgba(255,255,255,0.06)", "var(--line-2)"],
  accent: ["var(--signal-300)", "var(--signal-a08)", "var(--signal-a40)"],
  info: ["var(--steel-400)", "var(--info-soft)", "rgba(76,135,196,0.4)"],
  success: ["var(--moss-500)", "var(--success-soft)", "rgba(63,175,122,0.4)"],
  warning: ["var(--amber-500)", "var(--warning-soft)", "rgba(227,167,58,0.4)"],
} as const;

export function Badge({
  tone = "neutral",
  dot,
  children,
  style,
}: {
  tone?: keyof typeof T;
  dot?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const [c, bg, b] = T[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 20,
        padding: "0 7px",
        borderRadius: "var(--radius-xs)",
        background: bg,
        boxShadow: `inset 0 0 0 1px ${b}`,
        color: c,
        font: "500 10.5px/1 var(--font-mono)",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", boxShadow: "0 0 8px currentColor" }} />
      )}
      {children}
    </span>
  );
}
