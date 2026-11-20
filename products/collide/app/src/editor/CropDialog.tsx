// T39 (Grant 2026-11-17): Crop for an added image, after ../../layout-prototype.html. The whole file is shown with the kept
// part bright: drag inside the box to move it, a corner to resize it, outside it to draw a new one. Enter applies, Esc cancels.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Button } from "../ds/Button";
import { FULL_CROP } from "./engine";

export type CropBox = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "se" | "sw";
const CORNERS: readonly Corner[] = ["nw", "ne", "se", "sw"];
/** Smallest crop, as a fraction of the file. */
export const MIN_CROP = 0.03;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The new crop for a drag; pure, so it is unit-tested. `p` and `p0` are fractions of the file. */
export function dragCrop(kind: "move" | "new" | Corner, o: CropBox, p0: { x: number; y: number }, p: { x: number; y: number }): CropBox {
  if (kind === "move") {
    return { ...o, x: Math.min(1 - o.w, Math.max(0, o.x + p.x - p0.x)), y: Math.min(1 - o.h, Math.max(0, o.y + p.y - p0.y)) };
  }
  if (kind === "new") {
    const x = Math.min(p0.x, p.x), y = Math.min(p0.y, p.y);
    return { x, y, w: Math.min(Math.max(MIN_CROP, Math.abs(p.x - p0.x)), 1 - x), h: Math.min(Math.max(MIN_CROP, Math.abs(p.y - p0.y)), 1 - y) };
  }
  const x1 = kind.includes("w") ? Math.min(p.x, o.x + o.w - MIN_CROP) : o.x;
  const x2 = kind.includes("e") ? Math.max(p.x, o.x + MIN_CROP) : o.x + o.w;
  const y1 = kind.includes("n") ? Math.min(p.y, o.y + o.h - MIN_CROP) : o.y;
  const y2 = kind.includes("s") ? Math.max(p.y, o.y + MIN_CROP) : o.y + o.h;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

interface Props {
  /** The whole image file. */
  src: string;
  file: { width: number; height: number };
  crop: CropBox | undefined;
  onApply: (crop: CropBox) => void;
  onCancel: () => void;
}

export function CropDialog({ src, file, crop, onApply, onCancel }: Props) {
  const [c, setC] = useState<CropBox>(crop ?? FULL_CROP);
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "move" | "new" | Corner; o: CropBox; p0: { x: number; y: number } } | null>(null);
  const live = useRef({ c, onApply, onCancel });
  live.current = { c, onApply, onCancel };
  const k = Math.min(Math.min(720, window.innerWidth - 72) / file.width, Math.min(420, window.innerHeight - 240) / file.height);
  const VW = Math.max(120, Math.round(file.width * k)), VH = Math.max(80, Math.round(file.height * k));

  useLayoutEffect(() => card.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), []);
  useEffect(() => {
    // Capture phase, and nothing gets past: the editor underneath must not hear Delete, tool keys or Ctrl+Z.
    const key = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        live.current.onCancel();
      } else if (e.key === "Enter") {
        // Enter always applies, also with Reset or Cancel focused (as the prototype).
        e.preventDefault();
        live.current.onApply(live.current.c);
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);

  const at = (e: ReactPointerEvent) => {
    const b = stage.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - b.left) / b.width), y: clamp01((e.clientY - b.top) / b.height) };
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = at(e);
    const corner = (e.target as HTMLElement).dataset.corner as Corner | undefined;
    const inside = p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h;
    drag.current = { kind: corner ?? (inside ? "move" : "new"), o: c, p0: p };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) setC(dragCrop(d.kind, d.o, d.p0, at(e)));
  };
  const pct = (v: number) => `${v * 100}%`;
  const size = `${Math.round(c.w * file.width)} × ${Math.round(c.h * file.height)} of ${file.width} × ${file.height}`;

  return (
    <div className="splash" data-testid="crop-dialog">
      <div ref={card} className="splashcard" role="dialog" aria-modal="true" aria-labelledby="crop-title" tabIndex={-1} style={{ width: "auto", maxWidth: "calc(100vw - 32px)" }}>
        <div className="sin" style={{ paddingTop: 18 }}>
          <h2 id="crop-title">Crop image</h2>
          <p style={{ maxWidth: VW }}>Drag inside the box to move it, a corner to resize it, or outside it to draw a new one. The whole image is kept, so you can widen the crop later.</p>
          <div
            ref={stage}
            data-testid="crop-stage"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => (drag.current = null)}
            style={{ position: "relative", width: VW, height: VH, touchAction: "none", userSelect: "none", cursor: "crosshair", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--surface-2)" }}
          >
            <img src={src} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
            <div
              data-testid="crop-box"
              style={{
                position: "absolute",
                left: pct(c.x),
                top: pct(c.y),
                width: pct(c.w),
                height: pct(c.h),
                cursor: "move",
                outline: "2px solid var(--ink-50)",
                boxShadow: "0 0 0 9999px color-mix(in srgb, var(--ink-975) 55%, transparent)",
              }}
            />
            {CORNERS.map((d) => (
              <span
                key={d}
                data-corner={d}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: pct(d.includes("w") ? c.x : c.x + c.w),
                  top: pct(d.includes("n") ? c.y : c.y + c.h),
                  width: 14,
                  height: 14,
                  margin: "-7px 0 0 -7px",
                  borderRadius: 3,
                  background: "var(--ink-50)",
                  border: "2px solid var(--accent)",
                  cursor: d === "nw" || d === "se" ? "nwse-resize" : "nesw-resize",
                }}
              />
            ))}
          </div>
          <div style={{ width: "100%", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <span data-testid="crop-size" style={{ font: "var(--type-sm)", fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
              {size}
            </span>
            <span className="btnrow">
              <Button variant="ghost" onClick={() => setC({ ...FULL_CROP })}>
                Reset
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="primary" icon="crop" data-autofocus onClick={() => onApply(c)}>
                Apply
              </Button>
            </span>
          </div>
          <span className="hint">Enter applies · Esc cancels</span>
        </div>
      </div>
    </div>
  );
}
