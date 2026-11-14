import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Arrow, Circle, Ellipse, Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import Konva from "konva";
import type { Shape } from "../model";
import { BADGE_SIZE, calloutAt, DEFAULT_FONT_SIZE, isRealDrag, resizeShape, shapeFromDrag, textAt, type DrawTool, type Style } from "./geometry";
import type { NewShape, ShapePatch } from "./store";
import type { Tool } from "./tools";
import { imageToScreen, panBy, screenToImage, wheelFactor, zoomAt, type Point, type Size, type View } from "./viewport";

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
  selectedId: string | null;
  tool: Tool;
  /** Resolved style (hex) for new shapes. */
  style: Style;
  view: View;
  onViewChange: (update: (v: View) => View) => void;
  onSize: (s: Size) => void;
  onAdd: (shape: NewShape, numbered: boolean) => void;
  onUpdate: (id: string, patch: ShapePatch) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
  handleRef: React.MutableRefObject<CanvasHandle | null>;
}

/** Resolve a design-system CSS variable to a colour string Konva can paint. */
export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
// Controls that use Space themselves (A): pan still starts, but the key is left alone.
const isControlTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "BUTTON" || t.tagName === "SELECT" || t.tagName === "A" || t.getAttribute("role") === "button");

const measureText = (text: string, fontSize: number) => {
  const t = new Konva.Text({ text: text || " ", fontSize, fontFamily: cssVar("--font-sans") });
  return { w: t.width(), h: t.height() };
};

const isDrawTool = (t: Tool): t is DrawTool => t === "rect" || t === "ellipse" || t === "arrow";

interface Draft {
  tool: DrawTool;
  a: Point;
  b: Point;
}
interface TextEdit {
  /** Existing text shape being edited, or null for a new one. */
  id: string | null;
  at: Point;
  value: string;
  fontSize: number;
  color: string;
}

interface NodeProps {
  shape: Shape;
  interactive: boolean;
  hidden?: boolean;
  onSelect?: (id: string) => void;
  onMoved?: (id: string, x: number, y: number) => void;
  onEditText?: (id: string) => void;
}

function ShapeNode({ shape, interactive, hidden, onSelect, onMoved, onEditText }: NodeProps) {
  const steel = cssVar("--steel-500");
  const onInk = cssVar("--ink-50");
  const badge = (cx: number, cy: number, n: number) => (
    <Group x={cx - BADGE_SIZE / 2} y={cy - BADGE_SIZE / 2} listening={false}>
      <Circle x={BADGE_SIZE / 2} y={BADGE_SIZE / 2} radius={BADGE_SIZE / 2} fill={steel} />
      <Text width={BADGE_SIZE} height={BADGE_SIZE} align="center" verticalAlign="middle" text={String(n)} fontSize={12} fontStyle="600" fontFamily={cssVar("--font-mono")} fill={onInk} />
    </Group>
  );
  let main: React.ReactNode = null;
  let tail: Point = { x: 0, y: 0 };
  switch (shape.type) {
    case "rect":
    case "highlight":
      main = <Rect name="main" width={shape.w} height={shape.h} stroke={shape.stroke} strokeWidth={shape.strokeWidth} cornerRadius={4} fill="transparent" />;
      break;
    case "ellipse":
      main = (
        <Ellipse name="main" x={shape.w / 2} y={shape.h / 2} radiusX={shape.w / 2} radiusY={shape.h / 2} stroke={shape.stroke} strokeWidth={shape.strokeWidth} fill="transparent" />
      );
      break;
    case "arrow": {
      const len = Math.max(12, shape.strokeWidth * 4);
      tail = { x: shape.points[0], y: shape.points[1] };
      main = (
        <Arrow
          name="main"
          points={shape.points}
          stroke={shape.stroke}
          fill={shape.stroke}
          strokeWidth={shape.strokeWidth}
          pointerLength={len}
          pointerWidth={len}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(12, shape.strokeWidth)}
        />
      );
      break;
    }
    case "text":
      main = <Text name="main" text={shape.text} fontSize={shape.fontSize} fontFamily={cssVar("--font-sans")} fill={shape.stroke} />;
      break;
    case "callout":
      return (
        <Group id={shape.id} name="shape" x={shape.x} y={shape.y} visible={!hidden} listening={interactive} draggable={interactive} {...handlers(shape, onSelect, onMoved)}>
          <Circle name="main" x={BADGE_SIZE / 2} y={BADGE_SIZE / 2} radius={BADGE_SIZE / 2} fill={steel} />
          <Text width={BADGE_SIZE} height={BADGE_SIZE} align="center" verticalAlign="middle" text={String(shape.callout)} fontSize={12} fontStyle="600" fontFamily={cssVar("--font-mono")} fill={onInk} listening={false} />
        </Group>
      );
  }
  return (
    <Group
      id={shape.id}
      name="shape"
      x={shape.x}
      y={shape.y}
      visible={!hidden}
      listening={interactive}
      draggable={interactive}
      onDblClick={() => shape.type === "text" && onEditText?.(shape.id)}
      onDblTap={() => shape.type === "text" && onEditText?.(shape.id)}
      {...handlers(shape, onSelect, onMoved)}
    >
      {main}
      {shape.callout !== undefined && badge(tail.x, tail.y, shape.callout)}
    </Group>
  );
}

function handlers(shape: Shape, onSelect?: (id: string) => void, onMoved?: (id: string, x: number, y: number) => void) {
  return {
    onMouseDown: (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      onSelect?.(shape.id);
    },
    onTap: () => onSelect?.(shape.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target === e.currentTarget) onMoved?.(shape.id, e.target.x(), e.target.y());
    },
  };
}

export function Canvas({ image, shapes, selectedId, tool, style, view, onViewChange, onSize, onAdd, onUpdate, onRemove, onSelect, handleRef }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [edit, setEdit] = useState<TextEdit | null>(null);
  const spaceRef = useRef(false);
  const panRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const committed = useRef(false);

  // Latest props for window-level handlers.
  const live = useRef({ view, tool, style, onAdd });
  live.current = { view, tool, style, onAdd };

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
      if (!isControlTarget(e.target)) e.preventDefault();
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

  // Esc cancels a drag in progress.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && draftRef.current) {
        draftRef.current = null;
        setDraft(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  /** Pointer position in image pixels for a DOM event. */
  const toImage = useCallback((clientX: number, clientY: number): Point => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return screenToImage(live.current.view, { x: clientX - rect.left, y: clientY - rect.top });
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

  // Draw tools: pointer down starts a drag; window listeners follow it so it can end outside the canvas.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !image || edit) return;
    const t = live.current.tool;
    const p = toImage(e.clientX, e.clientY);
    if (t === "callout") {
      live.current.onAdd(calloutAt(p, live.current.style), true);
      return;
    }
    if (!isDrawTool(t)) return;
    const d: Draft = { tool: t, a: p, b: p };
    draftRef.current = d;
    setDraft(d);
    const move = (ev: PointerEvent) => {
      if (!draftRef.current) return;
      draftRef.current = { ...draftRef.current, b: toImage(ev.clientX, ev.clientY) };
      setDraft(draftRef.current);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const cur = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (!cur) return;
      const b = toImage(ev.clientX, ev.clientY);
      if (ev.type === "pointerup" && isRealDrag(cur.a, b, live.current.view.scale)) {
        live.current.onAdd(shapeFromDrag(cur.tool, cur.a, b, live.current.style), true);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Text tool: a click opens the editor (on click, so the textarea keeps focus).
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (live.current.tool !== "text" || !image || edit || spaceRef.current || e.button !== 0) return;
    committed.current = false;
    setEdit({ id: null, at: toImage(e.clientX, e.clientY), value: "", fontSize: DEFAULT_FONT_SIZE, color: style.stroke });
  };

  const editText = (id: string) => {
    const s = shapes.find((x) => x.id === id);
    committed.current = false;
    if (s?.type === "text") setEdit({ id, at: { x: s.x, y: s.y }, value: s.text, fontSize: s.fontSize, color: s.stroke });
  };

  const commitText = (value: string) => {
    if (!edit || committed.current) return;
    committed.current = true;
    const cur = edit;
    setEdit(null);
    const text = value.trimEnd();
    if (cur.id) {
      if (!text) onRemove(cur.id);
      else onUpdate(cur.id, { text, ...measureText(text, cur.fontSize) });
    } else if (text) {
      onAdd(textAt(cur.at, text, measureText(text, cur.fontSize), { stroke: cur.color, strokeWidth: style.strokeWidth }, cur.fontSize), false);
    }
  };

  const selected = tool === "select" ? shapes.find((s) => s.id === selectedId) : undefined;

  // Attach the Transformer to the selected shape's main node.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selected ? stage.findOne<Konva.Group>(`#${selected.id}`)?.findOne(".main") : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selected, size, image]);

  const onTransformEnd = () => {
    const tr = trRef.current;
    const node = tr?.nodes()[0];
    if (!node || !selected) return;
    const patch = resizeShape(selected, { x: node.x(), y: node.y(), scaleX: node.scaleX(), scaleY: node.scaleY() }, measureText);
    // Reset the node to its base pose; React applies the new geometry from the store.
    node.scale({ x: 1, y: 1 });
    node.position(selected.type === "ellipse" ? { x: selected.w / 2, y: selected.h / 2 } : { x: 0, y: 0 });
    onUpdate(selected.id, patch);
  };

  const sel = (id: string) => onSelect(id);
  const ink = cssVar("--ink-50");
  const canResize = selected && selected.type !== "callout";
  const keepRatio = selected?.type === "text";
  const cursor = panning ? "grabbing" : spaceDown ? "grab" : tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";
  const draftShape: Shape | null = draft
    ? ({ ...shapeFromDrag(draft.tool, draft.a, draft.b, style), id: "draft" } as Shape)
    : null;
  const editPos = edit ? imageToScreen(view, edit.at) : null;

  return (
    <div
      ref={wrapRef}
      data-testid="canvas"
      data-tool={tool}
      onPointerDownCapture={onPointerDownCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onClick={onClick}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        background: "var(--pattern-dots), var(--ink-950)",
        cursor,
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
          onMouseDown={(e) => {
            if (tool === "select" && e.target === e.target.getStage()) onSelect(null);
          }}
          onTouchStart={(e) => {
            if (tool === "select" && e.target === e.target.getStage()) onSelect(null);
          }}
        >
          <Layer>
            {image && <KonvaImage name="background" image={image.el} width={image.width} height={image.height} listening={false} />}
            {image &&
              shapes.map((s) => (
                <ShapeNode
                  key={s.id}
                  shape={s}
                  interactive={tool === "select"}
                  hidden={edit?.id === s.id}
                  onSelect={sel}
                  onMoved={(id, x, y) => onUpdate(id, { x, y })}
                  onEditText={editText}
                />
              ))}
            {draftShape && <ShapeNode shape={draftShape} interactive={false} />}
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              flipEnabled={false}
              ignoreStroke
              keepRatio={keepRatio}
              enabledAnchors={canResize ? ["top-left", "top-right", "bottom-left", "bottom-right"] : []}
              borderStroke={ink}
              borderStrokeWidth={1}
              borderDash={[4, 4]}
              anchorStroke={ink}
              anchorFill={cssVar("--ink-950")}
              anchorStrokeWidth={1}
              anchorSize={8}
              anchorCornerRadius={0}
              padding={2}
              boundBoxFunc={(oldBox, newBox) =>
                (newBox.width < 5 && newBox.width < oldBox.width) || (newBox.height < 5 && newBox.height < oldBox.height) ? oldBox : newBox
              }
              onTransformEnd={onTransformEnd}
            />
          </Layer>
        </Stage>
      )}
      {edit && editPos && (
        <textarea
          data-testid="text-editor"
          autoFocus
          rows={1}
          value={edit.value}
          placeholder="Type…"
          onChange={(e) => setEdit({ ...edit, value: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText(edit.value);
            } else if (e.key === "Escape") {
              committed.current = true;
              setEdit(null);
            }
          }}
          style={{
            position: "absolute",
            left: editPos.x,
            top: editPos.y,
            minWidth: 80,
            width: `${Math.max(8, edit.value.split("\n").reduce((m, l) => Math.max(m, l.length), 0) + 2)}ch`,
            margin: 0,
            padding: 0,
            border: 0,
            outline: `1px dashed ${ink}`,
            outlineOffset: 2,
            resize: "none",
            overflow: "hidden",
            background: "transparent",
            color: edit.color,
            font: `400 ${edit.fontSize * view.scale}px/1.2 var(--font-sans)`,
            transformOrigin: "top left",
          }}
        />
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
