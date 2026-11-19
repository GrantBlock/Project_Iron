import type { ReactNode } from "react";
import { IconButton, Tooltip } from "../ds";
import { ROLES, STROKE_WIDTHS, swatchBackground, TOOL_BUTTONS, type Role, type Tool } from "./tools";

// Ported from design-system/ui_kits/snip-markup/Toolbar.jsx. The callout toolbar (RUN3 T31, T32; T45 for Run 4):
// one set for every tab type (6.5): tools, Add border (6.6), the four colours, stroke, undo/redo. The save tools moved to
// the tab header (6.4: Copy, Save source, Save as). It grows and shrinks with the window and scrolls across only when
// the window is too narrow for every button (6.1). Markdown adds its text tools as a second row (6.2).

const Sep = () => <span className="tbsep" />;

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  /** The pressed colour; null after a draw (nothing pressed). */
  color: Role | null;
  setColor: (c: Role) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  fileName: string;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** T45 (6.6): a rectangle callout on the main image's (or the page's) edge. */
  onAddBorder: () => void;
  /** The toolbar's name: "Markup tools" (Snip), "PDF tools" or "Markdown tools" (RUN3 T34). */
  label?: string;
  /** Buttons after the tools (the Markdown editor's Insert image). */
  extra?: ReactNode;
  /** T45 (6.2): a second row under the callout tools (Markdown's text tools). */
  second?: ReactNode;
  hidden?: boolean;
}

export function Toolbar(props: Props) {
  const { tool, setTool, color, setColor, strokeWidth, setStrokeWidth, fileName, onUndo, onRedo, canUndo, canRedo, onAddBorder } = props;
  const { label = "Markup tools", extra, second, hidden } = props;
  return (
    <div data-testid="toolbar" className="ctoolbar" role="toolbar" aria-label={label} hidden={hidden}>
      <div className="tbrow">
        {TOOL_BUTTONS.map(([k, ic, l, s]) => (
          <Tooltip key={k} label={l} shortcut={s}>
            <IconButton icon={ic} label={l} active={tool === k} aria-pressed={tool === k} onClick={() => setTool(k)} />
          </Tooltip>
        ))}
        <Tooltip label="Add border: a rectangle callout round the main image, in the colour picked">
          <IconButton icon="square-dashed" label="Add border" onClick={onAddBorder} />
        </Tooltip>
        {extra}
        <Sep />
        <div role="group" aria-label="Colour for the next shape" style={{ display: "flex", gap: 6, padding: "6px 8px", borderRadius: "var(--radius-sm)", background: "var(--annot-box, #FFFFFF)" }}>
          {ROLES.map(([r, label]) => (
            <button
              key={r}
              type="button"
              onClick={() => setColor(r)}
              aria-label={label}
              title={color ? label : `${label} (pick a colour for the next shape)`}
              aria-pressed={color === r}
              data-testid="swatch"
              data-role={r}
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: swatchBackground(r),
                border: 0,
                cursor: "pointer",
                boxShadow: color === r ? "0 0 0 2px #FFFFFF, 0 0 0 4px #424242" : "inset 0 1px 0 rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </div>
        <Sep />
        <div style={{ display: "flex", gap: 2 }} role="group" aria-label="Stroke width">
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setStrokeWidth(w)}
              aria-label={`Stroke ${w}`}
              aria-pressed={strokeWidth === w}
              data-testid="stroke-width"
              style={{
                width: 28,
                height: 28,
                border: "1px solid transparent",
                borderRadius: "var(--radius-sm)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: strokeWidth === w ? "var(--text-1)" : "var(--text-3)",
                background:
                  strokeWidth === w
                    ? "linear-gradient(var(--surface-raised), var(--surface-raised)) padding-box, var(--glass-border) border-box"
                    : "transparent",
              }}
            >
              <span style={{ width: 14, height: w, borderRadius: 999, background: "currentColor" }} />
            </button>
          ))}
        </div>
        <div data-testid="file-name" className="tbname">
          {fileName}
        </div>
        <IconButton icon="undo-2" label="Undo" disabled={!canUndo} onClick={onUndo} style={canUndo ? undefined : { opacity: 0.4, cursor: "not-allowed" }} />
        <IconButton icon="redo-2" label="Redo" disabled={!canRedo} onClick={onRedo} style={canRedo ? undefined : { opacity: 0.4, cursor: "not-allowed" }} />
      </div>
      {second && (
        <div className="tbrow" role="group" aria-label="Text tools">
          {second}
        </div>
      )}
    </div>
  );
}
