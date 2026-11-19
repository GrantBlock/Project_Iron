// Editor document store: one pure reducer over the annotations doc and the selection.
// Wrapped by history.ts (T05) for undo/redo; keep every doc change an action here.
import { nextCalloutNumber, type AnnotationsDoc, type Crop, type Shape } from "../model";
import { sourceCrop } from "./engine";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A shape before the store gives it an id and (optionally) a callout number. */
export type NewShape = DistributiveOmit<Shape, "id" | "callout">;

/** Fields an `update` may change. */
export type ShapePatch = Partial<{
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  strokeWidth: number;
  note: string;
  label: { x: number; y: number; w: number };
  hideNumber: boolean;
  text: string;
  fontSize: number;
  points: [number, number, number, number];
  pts: number[];
  hideText: boolean;
  hideBubble: boolean;
  hideOutline: boolean;
  /** T39: an added image's crop; undefined = the whole image. */
  crop: { x: number; y: number; w: number; h: number } | undefined;
  fillPct: number;
  fill: boolean;
  type: "rect" | "ellipse" | "line" | "cross" | "point";
}>;

export interface EditorState {
  doc: AnnotationsDoc | null;
  selectedId: string | null;
}

export type Action =
  | { type: "load"; width: number; height: number; doc?: AnnotationsDoc }
  | { type: "add"; shape: NewShape; numbered?: boolean }
  | { type: "update"; id: string; patch: ShapePatch }
  | { type: "remove"; id: string }
  /** Remove several shapes in one step (the eraser). */
  | { type: "removeMany"; ids: string[] }
  /** Move a shape to `index` in draw order (0 = the back). */
  | { type: "reorder"; id: string; index: number }
  /** T46 (3.4): crop the first snip ("image 1"), as fractions of its file; every item moves with the picture. */
  | { type: "cropSource"; crop: Crop | undefined }
  | { type: "select"; id: string | null };

export const initialState: EditorState = { doc: null, selectedId: null };

/** Next free id: "a" + (highest numeric suffix + 1). */
export function nextShapeId(shapes: readonly Shape[]): string {
  let max = 0;
  for (const s of shapes) {
    const m = /^a(\d+)$/.exec(s.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `a${max + 1}`;
}

export function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "load":
      if (action.doc) return { doc: action.doc, selectedId: null };
      return { doc: { version: 1, source: { kind: "image", width: action.width, height: action.height }, shapes: [] }, selectedId: null };
    case "add": {
      if (!state.doc) return state;
      const shapes = state.doc.shapes;
      const id = nextShapeId(shapes);
      const base = { ...action.shape, id } as Shape;
      // Callout badges always carry a number; rect/ellipse/arrow get one on request (kit look).
      const shape: Shape = action.numbered || base.type === "callout" ? ({ ...base, callout: nextCalloutNumber(shapes) } as Shape) : base;
      return { doc: { ...state.doc, shapes: [...shapes, shape] }, selectedId: id };
    }
    case "update": {
      if (!state.doc) return state;
      const shapes = state.doc.shapes.map((s) => (s.id === action.id ? ({ ...s, ...action.patch } as Shape) : s));
      return { ...state, doc: { ...state.doc, shapes } };
    }
    case "remove": {
      if (!state.doc) return state;
      const shapes = state.doc.shapes.filter((s) => s.id !== action.id);
      return { doc: { ...state.doc, shapes }, selectedId: state.selectedId === action.id ? null : state.selectedId };
    }
    case "removeMany": {
      if (!state.doc || action.ids.length === 0) return state;
      const shapes = state.doc.shapes.filter((s) => !action.ids.includes(s.id));
      if (shapes.length === state.doc.shapes.length) return state;
      const selectedId = state.selectedId !== null && action.ids.includes(state.selectedId) ? null : state.selectedId;
      return { doc: { ...state.doc, shapes }, selectedId };
    }
    case "reorder": {
      if (!state.doc) return state;
      const from = state.doc.shapes.findIndex((s) => s.id === action.id);
      if (from < 0) return state;
      const to = Math.max(0, Math.min(state.doc.shapes.length - 1, action.index));
      if (to === from) return state;
      const shapes = [...state.doc.shapes];
      const [moved] = shapes.splice(from, 1);
      shapes.splice(to, 0, moved);
      return { ...state, doc: { ...state.doc, shapes } };
    }
    case "cropSource": {
      if (!state.doc) return state;
      const src = state.doc.source;
      const full = (c: Crop) => c.x < 1e-6 && c.y < 1e-6 && c.w > 1 - 1e-6 && c.h > 1 - 1e-6;
      const crop = action.crop && !full(action.crop) ? { ...action.crop } : undefined;
      const was = src.crop;
      if ((["x", "y", "w", "h"] as const).every((k) => Math.abs((was?.[k] ?? (k === "w" || k === "h" ? 1 : 0)) - (crop?.[k] ?? (k === "w" || k === "h" ? 1 : 0))) < 1e-6)) return state;
      // What stays visible stays where it was on the picture: items move by the change at the crop's top-left.
      const a = sourceCrop(src), b = sourceCrop({ ...src, crop });
      const dx = b.x - a.x, dy = b.y - a.y;
      const shapes = state.doc.shapes.map((s) => ({ ...s, x: s.x - dx, y: s.y - dy, ...(s.label ? { label: { ...s.label, x: s.label.x - dx, y: s.label.y - dy } } : {}) }) as Shape);
      const { crop: _old, ...rest } = src;
      void _old;
      return { ...state, doc: { ...state.doc, source: crop ? { ...rest, crop } : rest, shapes } };
    }
    case "select":
      return state.doc && state.selectedId !== action.id ? { ...state, selectedId: action.id } : state;
  }
}
