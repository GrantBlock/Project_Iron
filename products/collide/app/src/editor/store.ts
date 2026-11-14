// Editor document store: one pure reducer over the annotations doc and the selection.
// Wrapped by history.ts (T05) for undo/redo; keep every doc change an action here.
import { nextCalloutNumber, type AnnotationsDoc, type Shape } from "../model";

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
  text: string;
  fontSize: number;
  points: [number, number, number, number];
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
    case "select":
      return state.doc && state.selectedId !== action.id ? { ...state, selectedId: action.id } : state;
  }
}
