import { Button, IconButton, Tooltip } from "../ds";

// Ported from design-system/ui_kits/snip-markup/Toolbar.jsx. Tool/colour state is visual
// only until T04; New snip, Save, Export, Undo and Redo are wired in later tasks.
const tools: [string, string, string, string][] = [
  ["select", "mouse-pointer-2", "Select", "V"],
  ["rect", "square", "Rectangle", "R"],
  ["ellipse", "circle", "Ellipse", "O"],
  ["arrow", "move-up-right", "Arrow", "A"],
  ["text", "type", "Text", "T"],
];
const colors = ["var(--signal-500)", "var(--steel-500)", "var(--amber-500)", "var(--ink-50)"];

const Sep = () => <span style={{ width: 1, height: 20, background: "var(--line-2)", margin: "0 6px" }} />;

interface Props {
  tool: string;
  setTool: (t: string) => void;
  color: string;
  setColor: (c: string) => void;
  fileName: string;
  onOpenFile: () => void;
}

export function Toolbar({ tool, setTool, color, setColor, fileName, onOpenFile }: Props) {
  return (
    <div
      data-testid="toolbar"
      style={{ height: 52, boxSizing: "border-box", flex: "none", display: "flex", alignItems: "center", gap: 4, padding: "0 10px", borderBottom: "1px solid var(--line-1)" }}
    >
      <Tooltip label="New snip" shortcut="Ctrl+Alt+S">
        <Button variant="primary" size="sm" icon="scissors">
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
      <div data-testid="file-name" style={{ flex: 1, textAlign: "center", font: "400 12px/1 var(--font-mono)", color: "var(--text-3)" }}>
        {fileName}
      </div>
      <IconButton icon="undo-2" label="Undo" />
      <IconButton icon="redo-2" label="Redo" />
      <Sep />
      <IconButton icon="save" label="Save" />
      <Button size="sm" icon="share">
        Export
      </Button>
    </div>
  );
}
