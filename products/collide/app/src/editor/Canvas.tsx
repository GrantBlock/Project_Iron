import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Image as KonvaImage, Layer, Rect, Stage } from "react-konva";
import type Konva from "konva";
import type { Shape } from "../model";
import { panBy, wheelFactor, zoomAt, type Size, type View } from "./viewport";

export interface LoadedImage {
  el: HTMLImageElement;
  name: string;
  width: number;
  height: number;
}

export interface CanvasHandle {
  stage: () => Konva.Stage | null;
  container: () => HTMLDivElement | null;
}

interface Props {
  image: LoadedImage | null;
  shapes: Shape[];
  view: View;
  onViewChange: (update: (v: View) => View) => void;
  onSize: (s: Size) => void;
  handleRef: React.MutableRefObject<CanvasHandle | null>;
}

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export function Canvas({ image, shapes, view, onViewChange, onSize, handleRef }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const spaceRef = useRef(false);
  const panRef = useRef<{ id: number; x: number; y: number } | null>(null);

  handleRef.current = { stage: () => stageRef.current, container: () => wrapRef.current };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const s = { width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) };
      setSize(s);
      onSize(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onSize]);

  // Space = pan mode.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      spaceRef.current = true;
      setSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceRef.current = false;
      setSpaceDown(false);
    };
    const blur = () => {
      spaceRef.current = false;
      setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cursor = { x: e.evt.clientX - rect.left, y: e.evt.clientY - rect.top };
      const factor = wheelFactor(e.evt.deltaY);
      onViewChange((v) => zoomAt(v, cursor, v.scale * factor));
    },
    [onViewChange],
  );

  const onPointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!spaceRef.current || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setPanning(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = panRef.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    panRef.current = { ...p, x: e.clientX, y: e.clientY };
    onViewChange((v) => panBy(v, dx, dy));
  };
  const endPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.id !== e.pointerId) return;
    panRef.current = null;
    setPanning(false);
  };

  return (
    <div
      ref={wrapRef}
      data-testid="canvas"
      onPointerDownCapture={onPointerDownCapture}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        background: "var(--pattern-dots), var(--ink-950)",
        cursor: panning ? "grabbing" : spaceDown ? "grab" : "default",
        touchAction: "none",
      }}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          onWheel={onWheel}
        >
          <Layer>
            {image && <KonvaImage name="background" image={image.el} width={image.width} height={image.height} listening={false} />}
            {image &&
              shapes.map((s) => (
                <Rect
                  key={s.id}
                  id={s.id}
                  x={s.x}
                  y={s.y}
                  width={s.w}
                  height={s.h}
                  stroke={s.stroke}
                  strokeWidth={s.strokeWidth}
                  strokeScaleEnabled={false}
                />
              ))}
          </Layer>
        </Stage>
      )}
      {!image && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            font: "400 13px/1.4 var(--font-sans)",
            color: "var(--text-4)",
          }}
        >
          Open an image to start marking up.
        </div>
      )}
    </div>
  );
}
