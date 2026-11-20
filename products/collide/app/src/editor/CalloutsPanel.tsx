import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Badge, Icon } from "../ds";
import type { Shape } from "../model";
import { BASE_IMAGE_LABEL, calloutNumbers, canFill, fillPctOf, hiddenOf, imageLabel, isCallout, switchType, type CardType } from "./engine";
import type { ShapePatch } from "./store";
import { MAT, paintOf } from "./tools";

const NOTE_IDLE_MS = 500;
const TYPE_LABEL: Record<Shape["type"], string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  point: "Point",
  cross: "X mark",
  pen: "Pen",
  hl: "Highlighter",
  image: "Image",
  arrow: "Arrow",
  text: "Text",
  callout: "Callout",
  highlight: "Highlight",
};
/** Types a callout card can switch between. */
const CARD_TYPES: readonly CardType[] = ["rect", "ellipse", "line", "cross", "point"];
const isCardType = (t: string): t is CardType => (CARD_TYPES as readonly string[]).includes(t);

/** Readable text on a callout colour. */
function onColor(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#1F1F1F" : "#FFFFFF";
}

interface Props {
  /** Back to front, as stored; the list shows them front to back. */
  shapes: readonly Shape[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNote: (id: string, note: string) => void;
  /** Ends the current note typing burst (one undo step). */
  onCommit: () => void;
  onPatch: (id: string, patch: ShapePatch) => void;
  /** Move a shape to `index` in draw order (0 = the back). */
  onReorder: (id: string, index: number) => void;
  onRemove: (id: string) => void;
  /** T39: open Crop for an added image. */
  onCrop?: (id: string) => void;
  /** T46 (3.1, 3.4): the first snip, listed last as "image 1" with Crop and no delete. Snip tabs only. */
  base?: { cropped: boolean; onCrop: () => void };
  /** Put the cursor in this callout's note (after a draw); `n` changes on every request. */
  focus: { id: string; n: number } | null;
  /** Esc in a note: leave it and go back to Select. */
  onEscape: () => void;
}

const tog = { flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", border: "1px solid var(--line-2)", borderRadius: "var(--radius-sm)", cursor: "pointer" } as const;

/** Right pane: every item front to back (RUN3 T32). Callouts get a card; strokes and added images a plain row without a number. */
export function CalloutsPanel({ shapes, selectedId, onSelect, onNote, onCommit, onPatch, onReorder, onRemove, onCrop, base, focus, onEscape }: Props) {
  const numbers = calloutNumbers(shapes);
  const timer = useRef<number | undefined>(undefined);
  const notes = useRef(new Map<string, HTMLTextAreaElement>());
  const [dragId, setDragId] = useState<string | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (focus) notes.current.get(focus.id)?.focus();
  }, [focus]);
  const change = (id: string, note: string) => {
    onNote(id, note);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(onCommit, NOTE_IDLE_MS);
  };
  const commit = () => {
    window.clearTimeout(timer.current);
    onCommit();
  };
  const drop = (target: string) => (e: DragEvent) => {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!id || id === target) return;
    onReorder(id, shapes.findIndex((s) => s.id === target));
  };
  const grip = (s: Shape, label: string) => (
    <span
      draggable
      aria-label={`Reorder ${label}`}
      title="Drag to move it forward or back (numbers count from the back)"
      onDragStart={(e) => {
        setDragId(s.id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", s.id);
      }}
      onDragEnd={() => setDragId(null)}
      style={{ flex: "none", cursor: "grab", color: "var(--text-4)", display: "grid", placeItems: "center", alignSelf: "flex-start", paddingTop: 3 }}
    >
      <Icon name="grip-vertical" size={14} />
    </span>
  );
  const toggle = (s: Shape, field: "hideText" | "hideBubble" | "hideOutline", icon: string, on: string, off: string, pressed: boolean) => (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={pressed ? on : off}
      title={pressed ? on : off}
      onClick={(e) => {
        e.stopPropagation();
        onPatch(s.id, { [field]: !pressed });
      }}
      style={{ ...tog, background: pressed ? "var(--surface-3)" : "transparent", color: pressed ? "var(--text-1)" : "var(--text-3)" }}
    >
      <Icon name={icon} size={13} />
    </button>
  );
  const delBtn = (id: string, label: string) => (
    <button
      type="button"
      aria-label={`Delete ${label}`}
      title="Delete (Undo brings it back)"
      onClick={(e) => {
        e.stopPropagation();
        onRemove(id);
      }}
      style={{ ...tog, background: "transparent", color: "var(--text-3)" }}
    >
      <Icon name="trash-2" size={13} />
    </button>
  );
  const front = [...shapes].reverse();
  return (
    <aside
      data-testid="inspector"
      className="snipside"
      aria-label="Callouts"
      style={{ width: "var(--layout-inspector)", flex: "none", display: "flex", flexDirection: "column", borderLeft: "1px solid var(--line-1)", background: "var(--surface-1)", boxSizing: "border-box", minHeight: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40, flex: "none", padding: "0 12px", borderBottom: "1px solid var(--line-1)" }}>
        <span style={{ flex: 1, font: "500 10.5px/1 var(--font-mono)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-3)" }}>Callouts</span>
        <Badge>{numbers.size}</Badge>
      </div>
      <div data-testid="callouts" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, overflow: "auto", flex: 1, minHeight: 0 }}>
        {front.length > 0 && <span style={{ font: "var(--type-sm)", color: "var(--text-4)" }}>Front to back</span>}
        {front.map((s) => {
          const selected = s.id === selectedId;
          const paint = paintOf(s.stroke);
          const hid = hiddenOf(s);
          const card = {
            onClick: () => onSelect(s.id),
            onDragOver: (e: DragEvent) => e.preventDefault(),
            onDrop: drop(s.id),
            "aria-selected": selected,
            "data-id": s.id,
            style: {
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              padding: "6px 8px",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              background: selected ? "var(--surface-3)" : "transparent",
              boxShadow: selected ? "inset 0 0 0 1px var(--steel-500)" : "inset 0 0 0 1px var(--line-1)",
            },
          } as const;
          if (!isCallout(s)) {
            const label = s.type === "image" ? imageLabel(s.src) : TYPE_LABEL[s.type];
            return (
              <div key={s.id} data-testid={s.type === "image" ? "image-row" : "plain-row"} {...card}>
                {grip(s, TYPE_LABEL[s.type])}
                <span style={{ color: paint, display: "grid", placeItems: "center", paddingTop: 3 }}>
                  <Icon name={s.type === "hl" ? "highlighter" : s.type === "image" ? "image" : "pen-line"} size={14} />
                </span>
                <span style={{ font: "500 12px/20px var(--font-sans)", color: "var(--text-1)" }}>{label}</span>
                <span style={{ font: "var(--type-sm)", lineHeight: "20px", color: "var(--text-4)" }}>no number</span>
                <span style={{ flex: 1 }} />
                {s.type !== "image" && toggle(s, "hideOutline", "square", "Stroke hidden: click to show", "Hide the stroke (Copy and Export too)", hid.outline)}
                {s.type === "image" && onCrop && (
                  <button
                    type="button"
                    aria-label={`Crop ${label}`}
                    aria-pressed={!!s.crop}
                    title={s.crop ? "Crop this image (cropped)" : "Crop this image"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCrop(s.id);
                    }}
                    style={{ ...tog, background: s.crop ? "var(--surface-3)" : "transparent", color: "var(--text-3)" }}
                  >
                    <Icon name="crop" size={13} />
                  </button>
                )}
                {delBtn(s.id, label)}
              </div>
            );
          }
          const n = numbers.get(s.id)!;
          return (
            <div key={s.id} data-testid="callout-row" {...card}>
              {grip(s, `callout ${n}`)}
              <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span
                    data-testid="callout-badge"
                    style={{ width: 20, height: 20, flex: "none", borderRadius: 999, background: paint, color: onColor(paint), display: "grid", placeItems: "center", font: "600 10px/1 var(--font-mono)" }}
                  >
                    {n}
                  </span>
                  {isCardType(s.type) ? (
                    <select
                      aria-label={`Type of callout ${n}`}
                      value={s.type}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onPatch(s.id, switchType(s, e.target.value as CardType))}
                      style={{ minWidth: 0, background: "transparent", color: "var(--text-2)", border: "1px solid var(--line-2)", borderRadius: "var(--radius-sm)", font: "500 11px/1 var(--font-sans)", padding: "3px 4px" }}
                    >
                      {CARD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ font: "500 11px/1 var(--font-sans)", color: "var(--text-3)" }}>{TYPE_LABEL[s.type]}</span>
                  )}
                  <span style={{ flex: 1 }} />
                  {toggle(s, "hideText", "type", "Text hidden: click to show", "Hide the note text (keeps the number)", hid.text)}
                  {toggle(s, "hideBubble", "message-square", "Bubble hidden: click to show", "Hide the bubble and arrow (Copy and Export too)", hid.bubble)}
                  {toggle(s, "hideOutline", "square-dashed", "Outline hidden: click to show", "Hide the outline (keeps the fill)", hid.outline)}
                  {/* T46 (3.3): delete at once, no confirmation; Undo brings it back with its number. */}
                  {delBtn(s.id, `callout ${n}`)}
                </div>
                <textarea
                  ref={(el) => {
                    if (el) notes.current.set(s.id, el);
                    else notes.current.delete(s.id);
                  }}
                  data-testid="callout-note"
                  rows={2}
                  value={s.note ?? ""}
                  aria-label={`Note for callout ${n}`}
                  placeholder="Add a note"
                  onFocus={() => onSelect(s.id)}
                  onChange={(e) => change(s.id, e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.blur();
                      onEscape();
                    }
                  }}
                  style={{ background: "var(--surface-2)", border: "1px solid var(--line-1)", borderRadius: "var(--radius-sm)", outline: "none", color: "var(--text-1)", font: "var(--type-sm)", padding: "4px 6px", width: "100%", boxSizing: "border-box", resize: "vertical" }}
                />
                {canFill(s) && (
                  <label style={{ display: "flex", gap: 6, alignItems: "center", font: "500 10px/1 var(--font-mono)", color: "var(--text-3)" }} onClick={(e) => e.stopPropagation()}>
                    <span>Fill</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={fillPctOf(s)}
                      aria-label={`Fill of callout ${n}, percent`}
                      onChange={(e) => onPatch(s.id, { fillPct: Number(e.target.value), fill: false })}
                      style={{ flex: 1, accentColor: MAT.gray[1] }}
                    />
                    <span>{fillPctOf(s)}%</span>
                  </label>
                )}
              </div>
            </div>
          );
        })}
        {base && (
          <div
            data-testid="image-row"
            style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 8px", borderRadius: "var(--radius-sm)", boxShadow: "inset 0 0 0 1px var(--line-1)" }}
          >
            <span data-testid="base-image-row" style={{ display: "contents" }}>
              <span style={{ flex: "none", width: 14 }} />
              <span style={{ color: "var(--text-3)", display: "grid", placeItems: "center", paddingTop: 3 }}>
                <Icon name="image" size={14} />
              </span>
              <span style={{ font: "500 12px/20px var(--font-sans)", color: "var(--text-1)" }}>{BASE_IMAGE_LABEL}</span>
              <span style={{ font: "var(--type-sm)", lineHeight: "20px", color: "var(--text-4)" }}>first snip</span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                aria-label={`Crop ${BASE_IMAGE_LABEL}`}
                aria-pressed={base.cropped}
                title={base.cropped ? "Crop the first snip (cropped)" : "Crop the first snip"}
                onClick={base.onCrop}
                style={{ ...tog, background: base.cropped ? "var(--surface-3)" : "transparent", color: "var(--text-3)" }}
              >
                <Icon name="crop" size={13} />
              </button>
            </span>
          </div>
        )}
        {front.length === 0 && <div style={{ font: "var(--type-sm)", color: "var(--text-4)" }}>Draw on the image to add a callout.</div>}
      </div>
      <div data-testid="ai-pane" style={{ flex: "none", borderTop: "1px solid var(--line-1)" }} />
    </aside>
  );
}
