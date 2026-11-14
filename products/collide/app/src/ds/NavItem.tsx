import { useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

// Ported from design-system/components/navigation/NavItem.jsx.
export function NavItem({
  icon,
  label,
  meta,
  active,
  onClick,
  thumb,
}: {
  icon?: string;
  label: string;
  meta?: string;
  active?: boolean;
  onClick?: () => void;
  thumb?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: thumb ? "8px 10px" : "0 10px",
        minHeight: thumb ? 52 : 32,
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        background: active
          ? "linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0.03)) padding-box, var(--glass-border) border-box"
          : hover
            ? "rgba(255,255,255,0.04)"
            : "transparent",
        border: "1px solid transparent",
        color: active ? "var(--text-1)" : "var(--text-2)",
      }}
    >
      {thumb && (
        <span
          style={{
            width: 34,
            height: 34,
            flex: "none",
            borderRadius: "var(--radius-xs)",
            background: "var(--pattern-hatch), var(--surface-3)",
            boxShadow: "inset 0 0 0 1px var(--line-2)",
          }}
        />
      )}
      {icon && <Icon name={icon} size={15} color={active ? "var(--text-1)" : "var(--text-3)"} />}
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ font: "400 13px/1.25 var(--font-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        {meta && <span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--text-4)" }}>{meta}</span>}
      </span>
    </div>
  );
}

export function NavSection({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          font: "500 10.5px/1 var(--font-mono)",
          letterSpacing: "var(--tracking-label)",
          textTransform: "uppercase",
          color: "var(--text-4)",
          padding: "0 10px 8px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
