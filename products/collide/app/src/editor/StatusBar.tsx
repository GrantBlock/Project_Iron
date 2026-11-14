import { Kbd } from "../ds";

export function StatusBar({ zoom, dims }: { zoom: number; dims: { width: number; height: number } | null }) {
  return (
    <div
      style={{
        height: 28,
        boxSizing: "border-box",
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 14px",
        borderTop: "1px solid var(--line-1)",
        font: "400 11px/1 var(--font-mono)",
        color: "var(--text-3)",
      }}
    >
      <Kbd>Ctrl</Kbd>
      <Kbd>Alt</Kbd>
      <Kbd>S</Kbd>
      <span style={{ marginLeft: 4 }}>to snip</span>
      <span style={{ flex: 1 }} />
      <span data-testid="status-zoom">{Math.round(zoom * 100)}%</span>
      <span style={{ width: 1, height: 12, background: "var(--line-2)", margin: "0 8px" }} />
      <span data-testid="status-dims">{dims ? `${dims.width} × ${dims.height}` : "—"}</span>
    </div>
  );
}
