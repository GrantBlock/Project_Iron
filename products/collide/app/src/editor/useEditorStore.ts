import { useCallback, useRef, useState } from "react";
import { canRedo, canUndo, historyReducer, initialHistory, type HistoryAction, type HistoryState } from "./history";
import type { EditorState } from "./store";

/**
 * React binding for the editor store with undo/redo history. `stateRef` is updated synchronously
 * on every dispatch so callers (and the e2e test hook) always read the latest doc, even before a re-render.
 */
export function useEditorStore() {
  const historyRef = useRef<HistoryState>(initialHistory);
  const stateRef = useRef<EditorState>(initialHistory.present);
  const [history, setHistory] = useState<HistoryState>(initialHistory);
  const dispatch = useCallback((a: HistoryAction) => {
    const next = historyReducer(historyRef.current, a);
    if (next === historyRef.current) return;
    historyRef.current = next;
    stateRef.current = next.present;
    setHistory(next);
  }, []);
  return { state: history.present, dispatch, stateRef, canUndo: canUndo(history), canRedo: canRedo(history) };
}
