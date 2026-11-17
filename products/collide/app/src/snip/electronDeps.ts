import type { CollideBridge, OverlayEvent } from "../native/bridge";
import type { OverlayResult, SnipDeps } from "./flow";

export const FRAME_EVENT = "collide:overlay-frame";
export const READY_EVENT = "collide:overlay-ready";
export const PING_EVENT = "collide:overlay-ping";
export const ACK_EVENT = "collide:overlay-frame-ack";
export const RESULT_EVENT = "collide:overlay-result";

/** True in the Collide desktop app: the Electron preload put `window.collide` on the page. */
export const isDesktop = () => typeof window !== "undefined" && !!window.collide;

const NO_BRIDGE = "Collide's desktop shell is not available — open Collide from its installed app.";

/** Listen for one event; `done` resolves with its payload. The listener is live when this returns. */
function once<T>(bridge: CollideBridge, name: OverlayEvent, snipId?: number): { done: Promise<T> } {
  let resolveDone!: (v: T) => void;
  const done = new Promise<T>((r) => (resolveDone = r));
  const off = bridge.overlay.on(name, (payload) => {
    // Events from an earlier snip (or id-less ones) must not satisfy this snip's wait.
    if (snipId !== undefined && (payload as { snipId?: number } | null)?.snipId !== snipId) return;
    off();
    resolveDone(payload as T);
  });
  return { done };
}

const num = (v: unknown) => v as number;

/** The flow's command names (unchanged from the Rust shell) on the bridge's methods. */
export function invokeOn(bridge: CollideBridge, cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
  switch (cmd) {
    case "hide_editor":
      return bridge.hideEditor();
    case "prepare_overlay":
      return bridge.prepareOverlay();
    case "show_editor":
      return bridge.showEditor();
    case "capture_monitor":
      return bridge.captureMonitor();
    case "crop_capture":
      return bridge.cropCapture({ x: num(args.x), y: num(args.y), w: num(args.w), h: num(args.h) }, num(args.scale));
    case "show_overlay":
      return bridge.showOverlay({ x: num(args.x), y: num(args.y), width: num(args.width), height: num(args.height) });
    case "hide_overlay":
      return bridge.hideOverlay();
    default:
      return Promise.reject(new Error(`Unknown desktop command "${cmd}" — restart Collide.`));
  }
}

/** Real wiring: the preload bridge's methods + overlay events. The overlay window listens for FRAME_EVENT and emits RESULT_EVENT. */
export function electronDeps(rest: Pick<SnipDeps, "openImage" | "notify" | "delayMs">): SnipDeps {
  const bridge = isDesktop() ? window.collide : undefined;
  const need = (): CollideBridge => {
    if (!bridge) throw new Error(NO_BRIDGE);
    return bridge;
  };
  return {
    ...rest,
    invoke: bridge ? (cmd, args) => invokeOn(bridge, cmd, args) : undefined,
    waitForOverlayReady: async () => {
      const b = need();
      // Listen first, then ping, so a ready that fires in between is not lost.
      const ready = once<void>(b, READY_EVENT);
      b.overlay.emit(PING_EVENT);
      await ready.done;
    },
    sendFrame: async (png, scale, width, height, snipId) => {
      const b = need();
      const ack = once<void>(b, ACK_EVENT, snipId);
      b.overlay.emit(FRAME_EVENT, { png, scale, width, height, snipId });
      await ack.done;
    },
    waitForOverlayResult: async (snipId) => once<OverlayResult>(need(), RESULT_EVENT, snipId).done,
    now: () => new Date(),
    // Margin for the compositor to repaint the desktop after the editor leaves (it is made transparent and moved off-screen first; see src/native/windows.ts).
    settle: () => new Promise((r) => setTimeout(r, 300)),
  };
}
