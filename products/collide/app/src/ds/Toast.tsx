import type { CSSProperties } from "react";
import { Icon } from "./Icon";

// Ported from design-system/components/feedback/Toast.jsx (values unchanged).
const TONE = {
  neutral: ["circle-check", "var(--text-2)"],
  success: ["circle-check", "var(--success)"],
  error: ["circle-alert", "var(--danger)"],
  info: ["info", "var(--info)"],
} as const;

export interface ToastProps {
  tone?: keyof typeof TONE;
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  onClose?: () => void;
  style?: CSSProperties;
}

export function Toast({ tone = "neutral", title, description, action, onAction, onClose, style }: ToastProps) {
  const [ic, c] = TONE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        width: 340,
        padding: "12px 12px 12px 14px",
        boxSizing: "border-box",
        borderRadius: "var(--radius-md)",
        border: "1px solid transparent",
        background: "linear-gradient(var(--glass-fill-strong), var(--glass-fill-strong)) padding-box, var(--glass-border) border-box",
        backdropFilter: "blur(var(--blur-glass))",
        boxShadow: "var(--shadow-3)",
        ...style,
      }}
    >
      <Icon name={ic} size={16} color={c} style={{ marginTop: 1 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ font: "500 13px/1.3 var(--font-sans)", color: "var(--text-1)" }}>{title}</span>
        {description && <span style={{ font: "var(--type-sm)", fontSize: 12, color: "var(--text-3)" }}>{description}</span>}
      </div>
      {action && (
        <button onClick={onAction} style={{ background: "none", border: 0, color: "var(--text-1)", font: "500 12px/1 var(--font-sans)", cursor: "pointer", padding: "3px 4px", textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "var(--line-strong)" }}>
          {action}
        </button>
      )}
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" style={{ background: "none", border: 0, color: "var(--text-4)", cursor: "pointer", padding: 2, display: "grid" }}>
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}
