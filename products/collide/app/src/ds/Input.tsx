import { useState } from "react";
import type { CSSProperties, InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

// Ported from design-system/components/forms/Input.jsx.
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "style"> {
  icon?: string;
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
}

export function Input({ icon, size = "md", invalid, style, inputStyle, ...rest }: InputProps) {
  const [focus, setFocus] = useState(false);
  const h = { sm: 28, md: 34, lg: 42 }[size];
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: h,
        padding: "0 10px",
        borderRadius: "var(--radius-sm)",
        background: "var(--ink-950)",
        boxShadow: focus
          ? "inset 0 0 0 1px var(--signal-a40), 0 0 0 3px var(--signal-a08)"
          : invalid
            ? "inset 0 0 0 1px var(--danger)"
            : "var(--shadow-inset), inset 0 0 0 1px var(--line-2)",
        color: "var(--text-3)",
        transition: "box-shadow var(--dur-2) var(--ease-out)",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={14} />}
      <input
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...rest}
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          background: "transparent",
          border: 0,
          outline: "none",
          color: "var(--text-1)",
          font: `400 ${size === "lg" ? 14 : 13}px/1 var(--font-sans)`,
          ...inputStyle,
        }}
      />
    </label>
  );
}
