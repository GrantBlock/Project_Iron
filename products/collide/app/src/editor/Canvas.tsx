import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Arrow, Circle, Ellipse, Group, Image as KonvaImage, Label, Layer, Line, Rect, Shape as KonvaShape, Stage, Tag, Text, Transformer } from "react-konva";
import Konva from "konva";
import type { Shape } from "../model";
import { BADGE_SIZE, isRealDrag, resizeShape, shapeFromDrag, type DrawTool, type Style } from "./geometry";
import { hasNoteBox, layoutNotes, leader, NOTE_BADGE, NOTE_BADGE_GAP, NOTE_FONT, NOTE_MIN_W, NOTE_PAD, NOTE_W, noteSize, noteTextWidth, type Box } from "./notes";
import type { NewShape, ShapePatch } from "./store";
import { paintOf, type Tool } from "./tools";
import { fillPctOf, fromPoints, hiddenOf, highlighterWidth, strokesHit } from "./engine";
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
  /** The eraser took these strokes (one step). */
  onRemoveMany?: (ids: string[]) => void;
  handleRef: React.MutableRefObject<CanvasHandle | null>;
}

/** Resolve a design-system CSS variable to a colour string Konva can paint. */
export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const RIGHT_BUTTON = 2;
/** Right-button presses pan the view; they never select or deselect. */
const isPanButton = (evt: Event) => (evt as MouseEvent).button === RIGHT_BUTTON;

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
// Controls that use Space themselves (A): pan still starts, but the key is left alone.
const isControlTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "BUTTON" || t.tagName === "SELECT" || t.tagName === "A" || t.getAttribute("role") === "button");

const measureText = (text: string, fontSize: number) => {
  const t = new Konva.Text({ text: text || " ", fontSize, fontFamily: cssVar("--font-sans") });
  return { w: t.width(), h: t.height() };
};

/** Drag tools → the shape they draw. */
const DRAG_TOOLS: Partial<Record<Tool, DrawTool | "line">> = { rect: "rect", ellipse: "ellipse", cross: "cross", line: "line" };

const draftShapeOf = (d: Draft, style: Style): NewShape =>
  d.tool === "line" ? { type: "line", ...fromPoints([d.a, d.b]), ...style } : shapeFromDrag(d.tool, d.a, d.b, style);

/** "#RRGGBB" with an alpha, for fills. */
const withAlpha = (hex: string, a: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Placeholder in the on-canvas note editor. */
export const NOTE_PLACEHOLDER = "Describe…";

/** Height of `text` wrapped to `width` at the note font size. */
const measureNote = (text: string, width: number) =>
  new Konva.Text({ text: text || " ", fontSize: NOTE_FONT, fontFamily: cssVar("--font-sans"), width, wrap: "word", lineHeight: 1.25 }).height();

interface Draft {
  tool: DrawTool | "line";
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
  onDragMove?: (id: string, x: number, y: number) => void;
}

/** Longest a note label grows before it wraps, in image pixels (A). */
export const NOTE_MAX_WIDTH = 280;
const NOTE_FONT_SIZE = 12; // (A)
const LABEL_PAD = 6; // (A) legacy callout badge labels

/** A callout's note, drawn to the right of its badge so it shows in the view and in Copy. */
function NoteLabel({ x, y, note }: { x: number; y: number; note: string }) {
  const fontFamily = cssVar("--font-sans");
  const natural = new Konva.Text({ text: note, fontSize: NOTE_FONT_SIZE, fontFamily }).width();
  const width = Math.min(natural, NOTE_MAX_WIDTH - LABEL_PAD * 2);
  return (
    <Label name="note-label" x={x} y={y} listening={false}>
      <Tag fill={cssVar("--surface-2")} stroke={cssVar("--line-2")} strokeWidth={1} cornerRadius={4} />
      <Text text={note} width={Math.ceil(width) + LABEL_PAD * 2} padding={LABEL_PAD} fontSize={NOTE_FONT_SIZE} fontFamily={fontFamily} fill={cssVar("--text-1")} wrap="word" />
    </Label>
  );
}

function ShapeNode({ shape, interactive, hidden, onSelect, onMoved, onEditText, onDragMove }: NodeProps) {
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
  const paint = paintOf(shape.stroke);
  const hid = hiddenOf(shape);
  const fp = fillPctOf(shape);
  const fillOf = fp > 0 ? withAlpha(paint, fp / 100) : "transparent";
  const rel = () => {
    const p = shape.pts ?? [];
    return p.map((v, i) => (i % 2 === 0 ? v * shape.w : v * shape.h));
  };
  switch (shape.type) {
    case "rect":
    case "highlight":
      main = <Rect name="main" width={shape.w} height={shape.h} stroke={paint} strokeEnabled={!hid.outline} strokeWidth={shape.strokeWidth} cornerRadius={4} fill={fillOf} />;
      break;
    case "line":
      main = <Line name="main" points={rel()} stroke={paint} strokeWidth={shape.strokeWidth} lineCap="round" hitStrokeWidth={Math.max(12, shape.strokeWidth)} />;
      break;
    case "pen":
      main = <Line name="main" points={rel()} stroke={paint} strokeEnabled={!hid.outline} strokeWidth={shape.strokeWidth} lineCap="round" lineJoin="round" hitStrokeWidth={Math.max(12, shape.strokeWidth)} />;
      break;
    case "hl":
      main = (
        <Line name="main" points={rel()} stroke={paint} strokeEnabled={!hid.outline} strokeWidth={highlighterWidth(shape.strokeWidth)} opacity={0.4} lineCap="round" lineJoin="round" hitStrokeWidth={Math.max(12, highlighterWidth(shape.strokeWidth))} />
      );
      break;
    case "cross":
      main = (
        <KonvaShape
          name="main"
          width={shape.w}
          height={shape.h}
          stroke={paint}
          strokeWidth={shape.strokeWidth}
          lineCap="round"
          hitStrokeWidth={Math.max(12, shape.strokeWidth)}
          sceneFunc={(ctx, node) => {
            const w = node.width();
            const h = node.height();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(w, h);
            ctx.moveTo(w, 0);
            ctx.lineTo(0, h);
            ctx.strokeShape(node);
          }}
        />
      );
      break;
    case "ellipse":
      main = (
        <Ellipse name="main" x={shape.w / 2} y={shape.h / 2} radiusX={shape.w / 2} radiusY={shape.h / 2} stroke={paint} strokeEnabled={!hid.outline} strokeWidth={shape.strokeWidth} fill={fillOf} />
      );
      break;
    case "point": {
      const r = Math.max(4, shape.strokeWidth * 1.5);
      main = <Circle name="main" radius={r} fill={paint} stroke={cssVar("--ink-950")} strokeWidth={1.5} hitStrokeWidth={12} />;
      break;
    }
    case "arrow": {
      const len = Math.max(12, shape.strokeWidth * 4);
      tail = { x: shape.points[0], y: shape.points[1] };
      main = (
        <Arrow
          name="main"
          points={shape.points}
          stroke={paint}
          fill={paint}
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
      main = <Text name="main" text={shape.text} fontSize={shape.fontSize} fontFamily={cssVar("--font-sans")} fill={paint} />;
      break;
    case "callout":
      return (
        <Group id={shape.id} name="shape" x={shape.x} y={shape.y} visible={!hidden} listening={interactive} draggable={interactive} {...handlers(shape, onSelect, onMoved)}>
          <Circle name="main" x={BADGE_SIZE / 2} y={BADGE_SIZE / 2} radius={BADGE_SIZE / 2} fill={steel} />
          <Text width={BADGE_SIZE} height={BADGE_SIZE} align="center" verticalAlign="middle" text={String(shape.callout)} fontSize={12} fontStyle="600" fontFamily={cssVar("--font-mono")} fill={onInk} listening={false} />
          {shape.note?.trim() && <NoteLabel x={BADGE_SIZE + 4} y={0} note={shape.note.trim()} />}
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
      onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
        if (e.target === e.currentTarget) onDragMove?.(shape.id, e.target.x(), e.target.y());
      }}
    >
      {main}
      {shape.callout !== undefined && !hasNoteBox(shape) && badge(tail.x, tail.y, shape.callout)}
      {shape.callout !== undefined && !hasNoteBox(shape) && shape.note?.trim() && (
        <NoteLabel x={tail.x + BADGE_SIZE / 2 + 4} y={tail.y - BADGE_SIZE / 2} note={shape.note.trim()} />
      )}
    </Group>
  );
}

interface NoteBoxProps {
  shape: Shape;
  box: Box;
  selected: boolean;
  interactive: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number, done: boolean) => void;
  onResize: (id: string, w: number, done: boolean) => void;
  onEdit: (id: string) => void;
}

/** A numbered note box (auto-fit height, drag to move, drag the right edge to resize). */
function NoteBox({ shape, box, selected, interactive, onSelect, onMove, onResize, onEdit }: NoteBoxProps) {
  const note = shape.note?.trim() ?? "";
  const empty = note === "";
  const fontFamily = cssVar("--font-sans");
  const textX = NOTE_PAD + NOTE_BADGE + NOTE_BADGE_GAP;
  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, c: string) => {
    const el = e.target.getStage()?.container();
    if (el) el.style.cursor = c;
  };
  return (
    <Group
      name={hiddenOf(shape).bubble ? "note-box note-hidden" : "note-box"}
      opacity={hiddenOf(shape).bubble ? 0.35 : 1}
      x={box.x}
      y={box.y}
      listening={interactive}
      draggable={interactive}
      onMouseDown={(e) => {
        if (isPanButton(e.evt)) return;
        e.cancelBubble = true;
        onSelect(shape.id);
      }}
      onTap={() => onSelect(shape.id)}
      onDblClick={() => onEdit(shape.id)}
      onDblTap={() => onEdit(shape.id)}
      onDragMove={(e) => e.target === e.currentTarget && onMove(shape.id, e.target.x(), e.target.y(), false)}
      onDragEnd={(e) => e.target === e.currentTarget && onMove(shape.id, e.target.x(), e.target.y(), true)}
    >
      <Rect
        width={box.w}
        height={box.h}
        fill={cssVar("--surface-2")}
        stroke={selected ? paintOf(shape.stroke) : cssVar("--line-2")}
        strokeWidth={1}
        cornerRadius={4}
      />
      <Circle x={NOTE_PAD + NOTE_BADGE / 2} y={NOTE_PAD + NOTE_BADGE / 2} radius={NOTE_BADGE / 2} fill={cssVar("--steel-500")} listening={false} />
      <Text
        x={NOTE_PAD}
        y={NOTE_PAD}
        width={NOTE_BADGE}
        height={NOTE_BADGE}
        align="center"
        verticalAlign="middle"
        text={String(shape.callout)}
        fontSize={10}
        fontStyle="600"
        fontFamily={cssVar("--font-mono")}
        fill={cssVar("--ink-50")}
        listening={false}
      />
      {!empty && <Text
        name="note-text"
        x={textX}
        y={NOTE_PAD + Math.max(0, (NOTE_BADGE - NOTE_FONT * 1.25) / 2)}
        width={noteTextWidth(box.w)}
        text={note}
        fontSize={NOTE_FONT}
        lineHeight={1.25}
        fontFamily={fontFamily}
        fill={cssVar("--text-1")}
        wrap="word"
        listening={false}
      />}
      {interactive && !empty && (
        <Rect
          name="note-resize"
          x={box.w - 4}
          y={0}
          width={8}
          height={box.h}
          fill="transparent"
          draggable
          onMouseEnter={(e) => setCursor(e, "ew-resize")}
          onMouseLeave={(e) => setCursor(e, "")}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const w = Math.max(NOTE_MIN_W, e.target.x() + 4);
            e.target.position({ x: w - 4, y: 0 });
            onResize(shape.id, w, false);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            onResize(shape.id, Math.max(NOTE_MIN_W, e.target.x() + 4), true);
          }}
        />
      )}
    </Group>
  );
}

function handlers(shape: Shape, onSelect?: (id: string) => void, onMoved?: (id: string, x: number, y: number) => void) {
  return {
    onMouseDown: (e: Konva.KonvaEventObject<Event>) => {
      if (isPanButton(e.evt)) return;
      e.cancelBubble = true;
      onSelect?.(shape.id);
    },
    onTap: () => onSelect?.(shape.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target === e.currentTarget) onMoved?.(shape.id, e.target.x(), e.target.y());
    },
  };
}

export function Canvas({ image, shapes, selectedId, tool, style, view, onViewChange, onSize, onAdd, onUpdate, onRemove, onRemoveMany, onSelect, handleRef }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** Pen or highlighter stroke being drawn, in image pixels. */
  const [ink, setInk] = useState<{ tool: "pen" | "hl"; points: Point[] } | null>(null);
  /** Strokes the eraser has touched in this drag (removed on release, as one step). */
  const [erased, setErased] = useState<string[]>([]);
  const [edit, setEdit] = useState<TextEdit | null>(null);
  const spaceRef = useRef(false);
  /** Pan in progress: pointer and view at the start. The view follows (now - start), so a dropped move event cannot lose distance. */
  const panRef = useRef<{ id: number; x: number; y: number; view: View } | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const committed = useRef(false);
  /** Live position/size while a shape or note box is being dragged, so arrows follow. */
  const [moving, setMoving] = useState<{ id: string; shape?: Point; box?: Point; w?: number } | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ id: string; value: string } | null>(null);

  // Latest props for window-level handlers.
  const live = useRef({ view, tool, style, onAdd, onRemoveMany, shapes });
  live.current = { view, tool, style, onAdd, onRemoveMany, shapes };

  handleRef.current = { stage: () => stageRef.current, container: () => wrapRef.current };

  // Measure once before the first paint: a Snip tab mounts its canvas when it opens, and whoever opened it
  // (the test hook too) expects the stage to be there as soon as the tab is.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const s = { width: el.clientWidth, height: el.clientHeight };
    if (s.width <= 0 || s.height <= 0) return;
    setSize(s);
    onSize(s);
  }, [onSize]);

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

  // Pan: right-drag, or Space + left-drag.
  const onPointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!(e.button === RIGHT_BUTTON || (spaceRef.current && e.button === 0))) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, view: live.current.view };
    setPanning(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = panRef.current;
    if (!p || p.id !== e.pointerId) return;
    const start = p.view;
    onViewChange(() => panBy(start, e.clientX - p.x, e.clientY - p.y));
  };
  const endPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = panRef.current;
    if (p?.id !== e.pointerId) return;
    if (e.type === "pointerup") onViewChange(() => panBy(p.view, e.clientX - p.x, e.clientY - p.y));
    panRef.current = null;
    setPanning(false);
  };

  // Draw tools: pointer down starts a drag; window listeners follow it so it can end outside the canvas.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !image || edit) return;
    const t = live.current.tool;
    const p = toImage(e.clientX, e.clientY);
    if (t === "point") {
      live.current.onAdd({ type: "point", x: p.x, y: p.y, w: 0, h: 0, ...live.current.style }, true);
      return;
    }
    if (t === "pen" || t === "hl") {
      const pts: Point[] = [p];
      setInk({ tool: t, points: pts });
      const move = (ev: PointerEvent) => {
        const evs = typeof ev.getCoalescedEvents === "function" ? ev.getCoalescedEvents() : [];
        for (const c of evs.length ? evs : [ev]) {
          const q = toImage(c.clientX, c.clientY);
          const last = pts[pts.length - 1];
          if (q.x !== last.x || q.y !== last.y) pts.push(q);
        }
        setInk({ tool: t, points: [...pts] });
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        setInk(null);
        if (ev.type !== "pointerup" || pts.length < 2) return;
        live.current.onAdd({ type: t, ...fromPoints(pts), ...live.current.style }, false);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      return;
    }
    if (t === "eraser") {
      const reach = 6 / live.current.view.scale;
      const took = new Set<string>();
      let last = p;
      const touch = (a: Point, b: Point) => {
        const before = took.size;
        for (const id of strokesHit(live.current.shapes, a, b, reach)) took.add(id);
        if (took.size !== before) setErased([...took]);
      };
      touch(p, p);
      const move = (ev: PointerEvent) => {
        const q = toImage(ev.clientX, ev.clientY);
        touch(last, q);
        last = q;
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (ev.type === "pointerup") touch(last, toImage(ev.clientX, ev.clientY));
        setErased([]);
        if (took.size) live.current.onRemoveMany?.([...took]);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      return;
    }
    const dt = DRAG_TOOLS[t];
    if (!dt) return;
    const d: Draft = { tool: dt, a: p, b: p };
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
      if (ev.type === "pointerup" && isRealDrag(cur.a, b, live.current.view.scale)) live.current.onAdd(draftShapeOf({ ...cur, b }, live.current.style), true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
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
  const inkColor = cssVar("--ink-50");
  const canResize = selected && selected.type !== "callout" && selected.type !== "point";

  // Shapes as drawn right now (a shape being dragged moves its arrow live).
  const liveShapes = useMemo(
    () => shapes.map((s) => (moving?.shape && moving.id === s.id ? { ...s, x: moving.shape.x, y: moving.shape.y } : s)),
    [shapes, moving],
  );
  const notes = useMemo(() => {
    if (!image) return new Map<string, Box>();
    const boxes = layoutNotes(liveShapes, image, measureNote);
    if (moving && (moving.box || moving.w)) {
      const b = boxes.get(moving.id);
      const s = liveShapes.find((x) => x.id === moving.id);
      if (b && s) {
        boxes.set(moving.id, { ...b, ...(moving.box ?? {}), ...noteSize(s, moving.w ?? b.w, measureNote) });
      }
    }
    return boxes;
  }, [liveShapes, image, moving]);

  const onShapeDragMove = (id: string, x: number, y: number) => {
    // A rect/ellipse/point node sits at (x, y); an ellipse's Group is at its top-left too.
    setMoving({ id, shape: { x, y } });
  };
  const onBoxMove = (id: string, x: number, y: number, done: boolean) => {
    const b = notes.get(id);
    if (!b) return;
    if (done) {
      setMoving(null);
      onUpdate(id, { label: { x, y, w: b.w } });
    } else setMoving({ id, box: { x, y } });
  };
  const onBoxResize = (id: string, w: number, done: boolean) => {
    const b = notes.get(id);
    if (!b) return;
    if (done) {
      setMoving(null);
      onUpdate(id, { label: { x: b.x, y: b.y, w } });
    } else setMoving({ id, w });
  };
  const noteDone = useRef(false);
  const editNote = (id: string) => {
    const s = shapes.find((x) => x.id === id);
    if (!s) return;
    noteDone.current = false;
    onSelect(id);
    setNoteEdit({ id, value: s.note ?? "" });
  };
  /** Save the typed note (null = cancel). */
  const commitNote = (value: string | null) => {
    if (noteDone.current) return;
    noteDone.current = true;
    const cur = noteEdit;
    setNoteEdit(null);
    if (cur && value !== null && value.trim() !== (shapes.find((x) => x.id === cur.id)?.note ?? "").trim()) onUpdate(cur.id, { note: value.trim() });
  };
  const editBox = noteEdit ? notes.get(noteEdit.id) : undefined;
  const editBoxPos = editBox ? imageToScreen(view, { x: editBox.x + NOTE_PAD + NOTE_BADGE + NOTE_BADGE_GAP, y: editBox.y + NOTE_PAD }) : null;
  // Shift keeps the aspect (Konva flips keepRatio while Shift is held).
  const keepRatio = selected?.type === "text";
  const cursor = panning ? "grabbing" : spaceDown ? "grab" : tool === "select" ? "default" : "crosshair";
  const draftShape: Shape | null = draft ? ({ ...draftShapeOf(draft, style), id: "draft" } as Shape) : null;
  const inkShape: Shape | null = ink && ink.points.length > 1 ? ({ type: ink.tool, ...fromPoints(ink.points), ...style, id: "ink" } as Shape) : null;
  const editPos = edit ? imageToScreen(view, edit.at) : null;

  return (
    <div
      ref={wrapRef}
      data-testid="canvas"
      data-tool={tool}
      onPointerDownCapture={onPointerDownCapture}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        // The prototype's stage: the theme's canvas colour with a 16 px dot grid.
        background: "radial-gradient(var(--canvas-dot) 1px, transparent 1.2px) 0 0 / 16px 16px, var(--bg-canvas)",
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
            if (isPanButton(e.evt)) return;
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
                  hidden={edit?.id === s.id || erased.includes(s.id)}
                  onSelect={sel}
                  onMoved={(id, x, y) => {
                    setMoving(null);
                    onUpdate(id, { x, y });
                  }}
                  onDragMove={onShapeDragMove}
                  onEditText={editText}
                />
              ))}
            {image &&
              liveShapes.map((s) => {
                const box = notes.get(s.id);
                const pts = box && leader(s, box);
                if (!box || !pts) return null;
                return (
                  <Arrow
                    key={`leader-${s.id}`}
                    name={hiddenOf(s).bubble ? "note-leader note-hidden" : "note-leader"}
                    opacity={hiddenOf(s).bubble ? 0.35 : 1}
                    points={pts}
                    stroke={paintOf(s.stroke)}
                    fill={paintOf(s.stroke)}
                    strokeWidth={1.5}
                    pointerLength={8}
                    pointerWidth={8}
                    lineCap="round"
                    listening={false}
                  />
                );
              })}
            {image &&
              liveShapes.map((s) => {
                const box = notes.get(s.id);
                if (!box) return null;
                return (
                  <NoteBox
                    key={`note-${s.id}`}
                    shape={s}
                    box={box}
                    selected={s.id === selectedId}
                    interactive={tool === "select" && noteEdit?.id !== s.id}
                    onSelect={sel}
                    onMove={onBoxMove}
                    onResize={onBoxResize}
                    onEdit={editNote}
                  />
                );
              })}
            {draftShape && <ShapeNode shape={draftShape} interactive={false} />}
            {inkShape && <ShapeNode shape={inkShape} interactive={false} />}
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              flipEnabled={false}
              ignoreStroke
              keepRatio={keepRatio}
              enabledAnchors={canResize ? (keepRatio ? ["top-left", "top-right", "bottom-left", "bottom-right"] : ["top-left", "top-center", "top-right", "middle-right", "bottom-right", "bottom-center", "bottom-left", "middle-left"]) : []}
              borderStroke={inkColor}
              borderStrokeWidth={1}
              borderDash={[4, 4]}
              anchorStroke={inkColor}
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
            outline: `1px dashed ${inkColor}`,
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
      {noteEdit && editBox && editBoxPos && (
        <textarea
          data-testid="note-editor"
          autoFocus
          value={noteEdit.value}
          placeholder={NOTE_PLACEHOLDER}
          aria-label="Callout note"
          onChange={(e) => setNoteEdit({ ...noteEdit, value: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => commitNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitNote(noteEdit.value);
            } else if (e.key === "Escape") commitNote(null);
          }}
          style={{
            position: "absolute",
            left: editBoxPos.x,
            top: editBoxPos.y,
            width: noteTextWidth(Math.max(editBox.w, NOTE_W)) * view.scale,
            height: Math.max(editBox.h - NOTE_PAD * 2, NOTE_BADGE) * view.scale,
            margin: 0,
            padding: 0,
            border: 0,
            outline: `1px dashed ${inkColor}`,
            outlineOffset: 2,
            resize: "none",
            overflow: "hidden",
            background: "var(--surface-2)",
            color: "var(--text-1)",
            font: `400 ${NOTE_FONT * view.scale}px/1.25 var(--font-sans)`,
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
