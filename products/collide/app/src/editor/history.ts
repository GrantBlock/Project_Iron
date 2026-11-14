// Undo/redo history over the pure editor reducer (T05).
// Immutable snapshots of the editor state; selection changes are not steps (A);
// consecutive note edits on one shape coalesce into one step until `commit` (blur / 500 ms idle).
import { initialState, reducer, type Action, type EditorState } from "./store";

export const HISTORY_LIMIT = 50;

export type HistoryAction = Action | { type: "undo" } | { type: "redo" } | { type: "commit" };

export interface HistoryState {
  present: EditorState;
  /** Oldest first, at most HISTORY_LIMIT entries. */
  past: EditorState[];
  future: EditorState[];
  /** Shape id whose note is being typed; further note edits on it do not add steps. */
  burstId: string | null;
}

export const initialHistory: HistoryState = { present: initialState, past: [], future: [], burstId: null };

export const canUndo = (h: HistoryState) => h.past.length > 0;
export const canRedo = (h: HistoryState) => h.future.length > 0;

/** Restore a snapshot; keep its selection only if that shape still exists. */
function restore(snap: EditorState): EditorState {
  const ok = snap.selectedId !== null && !!snap.doc?.shapes.some((s) => s.id === snap.selectedId);
  return ok ? snap : { ...snap, selectedId: null };
}

const isNoteOnly = (a: Action) => a.type === "update" && Object.keys(a.patch).every((k) => k === "note");

export function historyReducer(h: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "undo": {
      const prev = h.past[h.past.length - 1];
      if (!prev) return h;
      return { present: restore(prev), past: h.past.slice(0, -1), future: [...h.future, h.present], burstId: null };
    }
    case "redo": {
      const next = h.future[h.future.length - 1];
      if (!next) return h;
      return { present: restore(next), past: [...h.past, h.present].slice(-HISTORY_LIMIT), future: h.future.slice(0, -1), burstId: null };
    }
    case "commit":
      return h.burstId === null ? h : { ...h, burstId: null };
    case "load":
      return { ...initialHistory, present: reducer(h.present, action) };
    case "select": {
      const present = reducer(h.present, action);
      return present === h.present ? h : { ...h, present };
    }
    default: {
      const present = reducer(h.present, action);
      if (present === h.present) return h;
      if (present.doc === h.present.doc) return { ...h, present };
      if (action.type === "update" && isNoteOnly(action) && h.burstId === action.id) return { ...h, present, future: [] };
      return {
        present,
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        future: [],
        burstId: action.type === "update" && isNoteOnly(action) ? action.id : null,
      };
    }
  }
}
