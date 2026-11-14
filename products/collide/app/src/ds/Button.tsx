import { useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

// Ported from design-system/components/actions/Button.jsx.
const H = { sm: 28, md: 34, lg: 42 };
const PX = { sm: 10, md: 14, lg: 18 };
const FS = { sm: 12, md: 13, lg: 14 };

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: string;
  iconRight?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

export function Button({ variant = "secondary", size = "md", icon, iconRight, disabled, children, style, ...rest }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const base: CSSProperties = {
    height: H[size],
    padding: `0 ${PX[size]}px`,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: variant === "outline" ? 999 : "var(--radius-sm)",
    font: `500 ${FS[size]}px/1 var(--font-sans)`,
    letterSpacing: "-0.005em",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
    transition:
      "background var(--dur-1) var(--ease-out), box-shadow var(--dur-2) var(--ease-out), transform var(--dur-1) var(--ease-out), color var(--dur-1)",
    transform: press && !disabled ? "scale(0.98)" : "none",
    outline: "none",
  };
  const accent = hover ? "var(--accent-hover)" : press ? "var(--accent-press)" : "var(--accent)";
  const raised = hover ? "var(--surface-raised)" : "var(--surface-3)";
  const v: Record<string, CSSProperties> = {
    primary: {
      color: "var(--text-on-signal)",
      background: `linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 50%) padding-box, linear-gradient(${accent}, ${accent}) padding-box, linear-gradient(180deg, rgba(255,255,255,0.35), rgba(0,0,0,0.2)) border-box`,
      boxShadow: hover ? "var(--glow-signal)" : "inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.5)",
    },
    secondary: {
      color: "var(--text-1)",
      background: `linear-gradient(${raised}, ${raised}) padding-box, var(--glass-border) border-box`,
      boxShadow: "var(--shadow-1)",
    },
    ghost: { color: hover ? "var(--text-1)" : "var(--text-2)", background: hover ? "rgba(255,255,255,0.06)" : "transparent" },
    outline: {
      color: "var(--text-1)",
      background: hover ? "rgba(255,255,255,0.06)" : "transparent",
      border: "1px solid var(--line-strong)",
    },
    danger: {
      color: "var(--signal-300)",
      background: hover ? "var(--signal-a16)" : "var(--signal-a08)",
      border: "1px solid var(--signal-a40)",
    },
  };
  const is = size === "lg" ? 16 : 14;
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      {...rest}
      style={{ ...base, ...v[variant], ...style }}
    >
      {icon && <Icon name={icon} size={is} />}
      {children}
      {iconRight && <Icon name={iconRight} size={is} />}
    </button>
  );
}
