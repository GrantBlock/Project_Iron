import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import type { OverlayResult, SnipDeps } from "./flow";

export const FRAME_EVENT = "collide:overlay-frame";
export const READY_EVENT = "collide:overlay-ready";
export const PING_EVENT = "collide:overlay-ping";
export const ACK_EVENT = "collide:overlay-frame-ack";
export const RESULT_EVENT = "collide:overlay-result";
export const SNIP_REQUEST_EVENT = "collide:snip-request";

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Listen for one event. `registered` resolves once the listener is live; `done` with its payload. */
function once<T>(name: string, snipId?: number): { registered: Promise<void>; done: Promise<T> } {
  let resolveDone!: (v: T) => void;
  const done = new Promise<T>((r) => (resolveDone = r));
  let fired = false;
  let unlisten: (() => void) | undefined;
  const registered = listen<T>(name, (e) => {
    if (fired) return;
    // Events from an earlier snip (or id-less ones) must not satisfy this snip's wait.
    if (snipId !== undefined && (e.payload as { snipId?: number } | null)?.snipId !== snipId) return;
    fired = true;
    unlisten?.();
    resolveDone(e.payload);
  }).then((f) => {
    unlisten = f;
    if (fired) f();
  });
  return { registered, done };
}

/** Real wiring: Tauri commands + events. The overlay window listens for FRAME_EVENT and emits RESULT_EVENT. */
export function tauriDeps(rest: Pick<SnipDeps, "openImage" | "notify">): SnipDeps {
  return {
    ...rest,
    invoke: isTauri() ? (cmd, args) => invoke(cmd, args) : undefined,
    waitForOverlayReady: async () => {
      // Listen first, then ping, so a ready that fires in between is not lost.
      const ready = once<void>(READY_EVENT);
      await ready.registered;
      await emit(PING_EVENT);
      await ready.done;
    },
    sendFrame: async (png, scale, width, height, snipId) => {
      const ack = once<void>(ACK_EVENT, snipId);
      await ack.registered;
      await emit(FRAME_EVENT, { png, scale, width, height, snipId });
      await ack.done;
    },
    waitForOverlayResult: (snipId) => once<OverlayResult>(RESULT_EVENT, snipId).done,
    now: () => new Date(),
    settle: () => new Promise((r) => setTimeout(r, 150)),
  };
}
