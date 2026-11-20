import { useCallback, useRef, useState } from "react";
import { canRedo, canUndo, historyReducer, initialHistory, type HistoryAction, type HistoryState } from "./history";
import type { EditorState } from "./store";

/**
 * React binding for the editor store with undo/redo history. `stateRef` is updated synchronously
 * on every dispatch so callers (and the e2e test hook) always read the latest doc, even before a re-render.
 * A Snip tab starts from its own history (`initial`) and hears every change (`onChange`), so the tab keeps
 * its document and undo steps while another tab is in front (RUN3 T31).
 */
export function useEditorStore(initial: HistoryState = initialHistory, onChange?: (h: HistoryState) => void) {
  const historyRef = useRef<HistoryState>(initial);
  const stateRef = useRef<EditorState>(initial.present);
  const [history, setHistory] = useState<HistoryState>(initial);
  const changed = useRef(onChange);
  changed.current = onChange;
  const dispatch = useCallback((a: HistoryAction) => {
    const next = historyReducer(historyRef.current, a);
    if (next === historyRef.current) return;
    historyRef.current = next;
    stateRef.current = next.present;
    changed.current?.(next);
    setHistory(next);
  }, []);
  return { state: history.present, dispatch, stateRef, canUndo: canUndo(history), canRedo: canRedo(history) };
}
