import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

// Ported from design-system/components/display/GlassPanel.jsx.
export interface GlassPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "style"> {
  variant?: "solid" | "floating";
  radius?: "xs" | "sm" | "md" | "lg" | "xl";
  glow?: boolean;
  pattern?: string;
  padding?: number | string;
  children?: ReactNode;
  style?: CSSProperties;
}

export function GlassPanel({
  variant = "solid",
  radius = "lg",
  glow,
  pattern,
  padding = 0,
  children,
  style,
  ...rest
}: GlassPanelProps) {
  const fill = variant === "floating" ? "var(--glass-fill)" : "var(--glass-fill-strong)";
  const pat = pattern ? `var(--pattern-${pattern}), ` : "";
  const blur = variant === "floating" ? "blur(var(--blur-glass)) saturate(140%)" : undefined;
  return (
    <div
      {...rest}
      style={{
        position: "relative",
        borderRadius: `var(--radius-${radius})`,
        border: "1px solid transparent",
        background: `${pat}linear-gradient(${fill}, ${fill}) padding-box, ${glow ? "var(--glass-border-signal)" : "var(--glass-border)"} border-box`,
        backdropFilter: blur,
        WebkitBackdropFilter: blur,
        boxShadow: `${variant === "floating" ? "var(--shadow-3)" : "var(--shadow-2)"}${glow ? ", 0 0 40px -12px rgba(255,61,31,0.5)" : ""}`,
        padding,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
