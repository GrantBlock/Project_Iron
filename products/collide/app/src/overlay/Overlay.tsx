import { useEffect, useRef, useState } from "react";
import { isEmptyBox, normalizeBox, readout, type Box, type Point } from "./box";

export type OverlayResult = { kind: "crop"; box: Box; scale: number } | { kind: "cancel" };

interface Props {
  /** Frozen frame URL (data URL in Tauri, fixture URL in a browser). */
  frame: string;
  /** Display scale factor: physical px per logical px. */
  scale: number;
  onResult: (r: OverlayResult) => void;
}

export function Overlay({ frame, scale, onResult }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const dragging = useRef(false);
  // Cancelled or lost capture mid-drag: drop the drag. A normal release keeps its box.
  const reset = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setStart(null);
    setBox(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResult({ kind: "cancel" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onResult]);

  const local = (e: React.PointerEvent): Point => {
    const r = root.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const bounds = () => {
    const r = root.current!.getBoundingClientRect();
    return { w: r.width, h: r.height };
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    dragging.current = true;
    setStart(p);
    setBox({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const move = (e: React.PointerEvent) => {
    if (start) setBox(normalizeBox(start, local(e), bounds()));
  };
  const up = (e: React.PointerEvent) => {
    if (!start) return;
    dragging.current = false;
    const final = normalizeBox(start, local(e), bounds());
    setStart(null);
    if (isEmptyBox(final)) {
      // Zero-size release (a plain click) is a no-op: the overlay stays open (A).
      setBox(null);
      return;
    }
    setBox(final);
    onResult({ kind: "crop", box: final, scale });
  };

  // Real image size when loaded, else the viewport in physical px.
  const vp = root.current?.getBoundingClientRect();
  const frameW = natural?.w ?? Math.round((vp?.width ?? 0) * scale);
  const frameH = natural?.h ?? Math.round((vp?.height ?? 0) * scale);
  const shown = box && !isEmptyBox(box) ? box : null;
  return (
    <div
      ref={root}
      data-testid="overlay"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={reset}
      onLostPointerCapture={reset}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        cursor: "crosshair",
        userSelect: "none",
        touchAction: "none",
        background: "var(--ink-975)",
      }}
    >
      <img
        data-testid="overlay-frame"
        src={frame}
        alt=""
        draggable={false}
        onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none" }}
      />
      {/* Dim layer (~50%). With a selection, the box is cut out via a huge spread shadow. */}
      {!shown && (
        <div
          data-testid="overlay-dim"
          style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--ink-975) 50%, transparent)", pointerEvents: "none" }}
        />
      )}
      {shown && (
        <>
          <div
            data-testid="overlay-selection"
            style={{
              position: "absolute",
              left: shown.x,
              top: shown.y,
              width: shown.w,
              height: shown.h,
              boxSizing: "border-box",
              boxShadow: "0 0 0 100vmax color-mix(in srgb, var(--ink-975) 50%, transparent)",
              outline: "1px dashed var(--line-dashed)",
              outlineOffset: -1,
              pointerEvents: "none",
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: i % 2 ? "calc(100% - 4px)" : -4,
                  top: i > 1 ? "calc(100% - 4px)" : -4,
                  width: 8,
                  height: 8,
                  background: "var(--ink-50)",
                  borderRadius: 0,
                }}
              />
            ))}
          </div>
          <div
            data-testid="overlay-readout"
            style={{
              position: "absolute",
              left: shown.x,
              top: shown.y >= 28 ? shown.y - 28 : shown.y + shown.h + 6,
              padding: "5px 7px",
              borderRadius: "var(--radius-xs)",
              background: "var(--steel-500)",
              color: "var(--text-on-signal)",
              font: "500 11px/1 var(--font-mono)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {readout(shown, scale, frameW, frameH)}
          </div>
        </>
      )}
      <div
        data-testid="overlay-hud"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 32,
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 14px",
          borderRadius: 999,
          border: "1px solid transparent",
          background: "linear-gradient(var(--glass-fill), var(--glass-fill)) padding-box, var(--glass-border) border-box",
          backdropFilter: "blur(24px)",
          boxShadow: "var(--shadow-3)",
          font: "500 10.5px/1 var(--font-mono)",
          letterSpacing: "var(--tracking-label)",
          textTransform: "uppercase",
          color: "var(--text-2)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--accent)", boxShadow: "0 0 10px var(--accent)" }} />
        <span>Esc to cancel · Release to crop</span>
      </div>
    </div>
  );
}
