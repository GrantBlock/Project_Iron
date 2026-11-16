import { Button, IconButton, Tooltip } from "../ds";
import { ROLES, STROKE_WIDTHS, swatchBackground, TOOL_BUTTONS, type Role, type Tool } from "./tools";

// Ported from design-system/ui_kits/snip-markup/Toolbar.jsx. The toolbar of a Snip tab (RUN3 T31, T32):
// tools, the four colours, stroke; undo/redo and actions on the right. Canvas snip is gone (Grant 2026-11-15).
const Sep = () => <span style={{ width: 1, height: 20, background: "var(--line-2)", margin: "0 6px" }} />;

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
  onExport: () => void;
  onCopy: () => void;
  canExport: boolean;
}

export function Toolbar({ tool, setTool, color, setColor, strokeWidth, setStrokeWidth, fileName, onUndo, onRedo, canUndo, canRedo, onExport, onCopy, canExport }: Props) {
  return (
    <div
      data-testid="toolbar"
      role="toolbar"
      aria-label="Markup tools"
      style={{ height: 52, boxSizing: "border-box", flex: "none", display: "flex", alignItems: "center", gap: 4, padding: "0 10px", borderBottom: "1px solid var(--line-1)", background: "var(--surface-1)", overflowX: "auto" }}
    >
      {TOOL_BUTTONS.map(([k, ic, l, s]) => (
        <Tooltip key={k} label={l} shortcut={s}>
          <IconButton icon={ic} label={l} active={tool === k} aria-pressed={tool === k} onClick={() => setTool(k)} />
        </Tooltip>
      ))}
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
      <div data-testid="file-name" style={{ flex: 1, textAlign: "center", font: "400 12px/1 var(--font-mono)", color: "var(--text-3)" }}>
        {fileName}
      </div>
      <IconButton icon="undo-2" label="Undo" disabled={!canUndo} onClick={onUndo} style={canUndo ? undefined : { opacity: 0.4, cursor: "not-allowed" }} />
      <IconButton icon="redo-2" label="Redo" disabled={!canRedo} onClick={onRedo} style={canRedo ? undefined : { opacity: 0.4, cursor: "not-allowed" }} />
      <Sep />
      <Tooltip label="Copy image to clipboard" shortcut="Ctrl+Shift+C">
        <IconButton icon="clipboard-copy" label="Copy to clipboard" data-testid="copy-btn" onClick={onCopy} disabled={!canExport} />
      </Tooltip>
      <Button size="sm" icon="share" onClick={onExport} disabled={!canExport} data-testid="export-btn">
        Export
      </Button>
    </div>
  );
}
