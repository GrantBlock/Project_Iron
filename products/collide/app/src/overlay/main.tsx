import React from "react";
import ReactDOM from "react-dom/client";
import "../../../design-system/styles.css";
import { emit, listen } from "@tauri-apps/api/event";
import { flushSync } from "react-dom";
import { createOverlayBridge, type FramePayload } from "./bridge";
import { Overlay, type OverlayResult } from "./Overlay";

const inTauri = "__TAURI_INTERNALS__" in window;
const bridge = createOverlayBridge({
  decode: async (png) => {
    const img = new Image();
    img.src = png;
    await img.decode();
  },
  setFrame: (png, scale, w) => window.__collideOverlay.setFrame(png, scale, w),
  emit: (event, payload) => void emit(event, payload),
});

// Test/host hook. T11 (Tauri) sets the frame via setFrame and listens for results
// through the "collide:overlay-result" window event or onResult.
export interface OverlayHook {
  lastResult: OverlayResult | null;
  results: OverlayResult[];
  setFrame: (url: string, scale: number, physicalWidth?: number) => void;
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
  const [state, setState] = React.useState<{ frame: string; scale: number; n: number; physW?: number } | null>(
    params.get("fixture")
      ? { frame: params.get("fixture")!, scale: scaleParam > 0 ? scaleParam : window.devicePixelRatio || 1, n: 0 }
      : null,
  );
  React.useEffect(() => {
    window.__collideOverlay.setFrame = (frame, scale, physW) =>
      flushSync(() => setState((s) => ({ frame, scale, physW, n: (s?.n ?? 0) + 1 })));
    if (!inTauri) return;
    // T11 handshake: register listeners first, then announce ready. See bridge.ts for frame/ack/result.
    const unlisteners = [
      listen<FramePayload>("collide:overlay-frame", (e) => void bridge.onFrame(e.payload)),
      listen("collide:overlay-ping", () => void emit("collide:overlay-ready")),
    ];
    void Promise.all(unlisteners).then(() => emit("collide:overlay-ready"));
    return () => unlisteners.forEach((u) => void u.then((f) => f()));
  }, []);
  const onResult = React.useCallback((r: OverlayResult) => {
    const hook = window.__collideOverlay;
    hook.lastResult = r;
    hook.results.push(r);
    hook.onResult?.(r);
    window.dispatchEvent(new CustomEvent("collide:overlay-result", { detail: r }));
    if (inTauri) bridge.onResult(r); // to the editor window (T11), tagged with the snipId
  }, []);
  // Esc must work even when no frame arrived (a blank topmost overlay must never trap the user).
  React.useEffect(() => {
    if (state) return; // the Overlay component owns Esc once a frame is shown
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResult({ kind: "cancel" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onResult]);
  return state ? <Overlay key={state.n} frame={state.frame} scale={state.scale} physicalWidth={state.physW} onResult={onResult} /> : null;
}

window.__collideOverlay = { lastResult: null, results: [], setFrame: () => {} };
document.body.style.background = "transparent";
document.documentElement.style.background = "transparent";
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
