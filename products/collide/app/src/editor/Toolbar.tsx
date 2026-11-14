import { Button, IconButton, Tooltip } from "../ds";
import { STROKE_WIDTHS, type Tool } from "./tools";

// Ported from design-system/ui_kits/snip-markup/Toolbar.jsx. New snip, Save and Export are wired in later tasks.
const tools: [Tool, string, string, string][] = [
  ["select", "mouse-pointer-2", "Select", "V"],
  ["rect", "square", "Rectangle", "R"],
  ["ellipse", "circle", "Ellipse", "O"],
  ["arrow", "move-up-right", "Arrow", "A"],
  ["text", "type", "Text", "T"],
  ["callout", "hash", "Callout", "C"],
];
const colors = ["var(--signal-500)", "var(--steel-500)", "var(--amber-500)", "var(--ink-50)"];

const Sep = () => <span style={{ width: 1, height: 20, background: "var(--line-2)", margin: "0 6px" }} />;

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  fileName: string;
  onOpenFile: () => void;
  onNewSnip: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  canExport: boolean;
  onSave: () => void;
  onOpenMarkup: () => void;
}

export function Toolbar({ tool, setTool, color, setColor, strokeWidth, setStrokeWidth, fileName, onOpenFile, onNewSnip, onUndo, onRedo, canUndo, canRedo, onExport, canExport, onSave, onOpenMarkup }: Props) {
  return (
    <div
      data-testid="toolbar"
      style={{ height: 52, boxSizing: "border-box", flex: "none", display: "flex", alignItems: "center", gap: 4, padding: "0 10px", borderBottom: "1px solid var(--line-1)" }}
    >
      <Tooltip label="New snip" shortcut="Ctrl+Alt+S">
        <Button variant="primary" size="sm" icon="scissors" onClick={onNewSnip} data-testid="new-snip">
          New snip
        </Button>
      </Tooltip>
      <IconButton icon="file-up" label="Open file" data-testid="open-file" onClick={onOpenFile} />
      <Sep />
      {tools.map(([k, ic, l, s]) => (
        <Tooltip key={k} label={l} shortcut={s}>
          <IconButton icon={ic} label={l} active={tool === k} onClick={() => setTool(k)} />
        </Tooltip>
      ))}
      <Sep />
      <div style={{ display: "flex", gap: 6, padding: "0 4px" }}>
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label="Color"
            aria-pressed={color === c}
            data-testid="swatch"
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: c,
              border: 0,
              cursor: "pointer",
              boxShadow: color === c ? `0 0 0 2px var(--ink-900), 0 0 0 3px ${c}` : "inset 0 1px 0 rgba(255,255,255,0.25)",
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
      <IconButton icon="folder-open" label="Open markup" data-testid="open-markup" onClick={onOpenMarkup} />
      <Tooltip label="Save markup" shortcut="Ctrl+S">
        <IconButton icon="save" label="Save" data-testid="save-markup" onClick={onSave} disabled={!canExport} />
      </Tooltip>
      <Button size="sm" icon="share" onClick={onExport} disabled={!canExport} data-testid="export-btn">
        Export
      </Button>
    </div>
  );
}
