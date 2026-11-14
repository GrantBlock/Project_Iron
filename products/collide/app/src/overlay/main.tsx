import React from "react";
import ReactDOM from "react-dom/client";
import "../../../design-system/styles.css";
import { Overlay, type OverlayResult } from "./Overlay";

// Test/host hook. T11 (Tauri) sets the frame via setFrame and listens for results
// through the "collide:overlay-result" window event or onResult.
export interface OverlayHook {
  lastResult: OverlayResult | null;
  results: OverlayResult[];
  setFrame: (url: string, scale: number) => void;
  onResult?: (r: OverlayResult) => void;
}
declare global {
  interface Window {
    __collideOverlay: OverlayHook;
  }
}

const params = new URLSearchParams(window.location.search);
const scaleParam = Number(params.get("scale"));

function Root() {
  const [state, setState] = React.useState<{ frame: string; scale: number } | null>(
    params.get("fixture")
      ? { frame: params.get("fixture")!, scale: scaleParam > 0 ? scaleParam : window.devicePixelRatio || 1 }
      : null,
  );
  React.useEffect(() => {
    window.__collideOverlay.setFrame = (frame, scale) => setState({ frame, scale });
  }, []);
  const onResult = React.useCallback((r: OverlayResult) => {
    const hook = window.__collideOverlay;
    hook.lastResult = r;
    hook.results.push(r);
    hook.onResult?.(r);
    window.dispatchEvent(new CustomEvent("collide:overlay-result", { detail: r }));
  }, []);
  return state ? <Overlay frame={state.frame} scale={state.scale} onResult={onResult} /> : null;
}

window.__collideOverlay = { lastResult: null, results: [], setFrame: () => {} };
document.body.style.background = "transparent";
document.documentElement.style.background = "transparent";
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
