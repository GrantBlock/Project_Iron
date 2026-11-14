import { useCallback, useRef, useState } from "react";
import { initialState, reducer, type Action, type EditorState } from "./store";

/**
 * React binding for the editor store. `stateRef` is updated synchronously on every dispatch
 * so callers (and the e2e test hook) always read the latest doc, even before a re-render.
 */
export function useEditorStore() {
  const stateRef = useRef<EditorState>(initialState);
  const [state, setState] = useState<EditorState>(initialState);
  const dispatch = useCallback((a: Action) => {
    const next = reducer(stateRef.current, a);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);
  return { state, dispatch, stateRef };
}
