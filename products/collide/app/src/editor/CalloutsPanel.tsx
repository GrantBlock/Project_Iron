import { useEffect, useRef } from "react";
import { Badge } from "../ds";
import type { Shape } from "../model";
import { hasNoteBox } from "./notes";

const NOTE_IDLE_MS = 500;
const TYPE_LABEL: Record<Shape["type"], string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  point: "Point",
  cross: "X mark",
  arrow: "Arrow",
  text: "Text",
  callout: "Callout",
  highlight: "Highlight",
};

interface Props {
  shapes: readonly Shape[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNote: (id: string, note: string) => void;
  /** Ends the current note typing burst (one undo step). */
  onCommit: () => void;
  /** Toggle "Hide #" (number box + arrow left out of Copy/Export). */
  onToggleHide: (id: string) => void;
}

/** Right pane: Callouts list on top (kit Inspector), empty AI placeholder below. */
export function CalloutsPanel({ shapes, selectedId, onSelect, onNote, onCommit, onToggleHide }: Props) {
  const callouts = shapes.filter((s) => s.callout !== undefined);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const change = (id: string, note: string) => {
    onNote(id, note);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(onCommit, NOTE_IDLE_MS);
  };
  const commit = () => {
    window.clearTimeout(timer.current);
    onCommit();
  };
  return (
    <aside
      data-testid="inspector"
      aria-label="Callouts"
      style={{ width: "var(--layout-inspector)", flex: "none", display: "flex", flexDirection: "column", borderLeft: "1px solid var(--line-1)", background: "var(--surface-1)", boxSizing: "border-box", minHeight: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40, flex: "none", padding: "0 12px", borderBottom: "1px solid var(--line-1)" }}>
        <span style={{ flex: 1, font: "500 10.5px/1 var(--font-mono)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-3)" }}>Callouts</span>
        <Badge>{callouts.length}</Badge>
      </div>
      <div data-testid="callouts" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflow: "auto", flex: "none" }}>
        {callouts.map((s) => {
          const selected = s.id === selectedId;
          return (
            <div
              key={s.id}
              data-testid="callout-row"
              data-id={s.id}
              aria-selected={selected}
              onClick={() => onSelect(s.id)}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                background: selected ? "var(--surface-3)" : "transparent",
                boxShadow: selected ? "inset 0 0 0 1px var(--steel-500)" : "none",
              }}
            >
              <span
                data-testid="callout-badge"
                style={{ width: 18, height: 18, flex: "none", marginTop: 1, borderRadius: 999, background: "var(--steel-500)", color: "var(--text-1)", display: "grid", placeItems: "center", font: "600 10px/1 var(--font-mono)" }}
              >
                {s.callout}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ font: "500 10px/1 var(--font-mono)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-4)" }}>{s.fill ? `Filled ${TYPE_LABEL[s.type].toLowerCase()}` : TYPE_LABEL[s.type]}</span>
                <input
                  data-testid="callout-note"
                  value={s.note ?? ""}
                  aria-label={`Note for callout ${s.callout}`}
                  placeholder="Describe this callout…"
                  onFocus={() => onSelect(s.id)}
                  onChange={(e) => change(s.id, e.target.value)}
                  onBlur={commit}
                  style={{ background: "transparent", border: 0, outline: "none", color: "var(--text-1)", font: "var(--type-sm)", padding: 0, width: "100%" }}
                />
              </div>
              {hasNoteBox(s) && (
                <button
                  type="button"
                  data-testid="hide-number"
                  aria-pressed={!!s.hideNumber}
                  title={s.hideNumber ? "Number and arrow are hidden from Copy and Export" : "Hide this number and arrow from Copy and Export"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleHide(s.id);
                  }}
                  style={{
                    flex: "none",
                    alignSelf: "center",
                    padding: "3px 6px",
                    border: "1px solid var(--line-2)",
                    borderRadius: "var(--radius-sm)",
                    background: s.hideNumber ? "var(--surface-2)" : "transparent",
                    color: s.hideNumber ? "var(--text-1)" : "var(--text-3)",
                    font: "500 10px/1 var(--font-mono)",
                    letterSpacing: "var(--tracking-label)",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {s.hideNumber ? "Show #" : "Hide #"}
                </button>
              )}
            </div>
          );
        })}
        {callouts.length === 0 && <div style={{ font: "var(--type-sm)", color: "var(--text-4)" }}>Draw on the image to add a callout.</div>}
      </div>
      <div data-testid="ai-pane" style={{ flex: 1, minHeight: 0, borderTop: "1px solid var(--line-1)" }} />
    </aside>
  );
}
