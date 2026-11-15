// T14: the main-process side of `window.collide`. `registerBridge` wires every
// channel of the preload bridge; Electron's modules are passed in, so the whole
// table is unit-tested with a fake `ipcMain`.
//
// Real in T14: captureMonitor, cropCapture and the overlay event relay.
// Typed stubs (they reject with a message naming their task): the window moves,
// copyImage and settingsStatus (T15) and markups.* (T16).

import {
  IMPLEMENTED,
  INVOKE_CHANNELS,
  OVERLAY_EVENT_CHANNEL,
  OVERLAY_EVENTS,
  STUB_TASK,
  type InvokeMethod,
  type IpcReply,
} from "./bridge";
import { CaptureState, cropFromState, type Capturer, type FrameImage } from "./capture";
import { captureMonitor, electronCapturer, type ElectronCaptureDeps } from "./electronCapturer";
import type { LogicalRect } from "../snip/crop";

export interface IpcEventLike {
  senderFrame?: { url: string } | null;
}

export interface IpcMainLike {
  handle(channel: string, listener: (event: IpcEventLike, ...args: unknown[]) => unknown): void;
  on(channel: string, listener: (event: IpcEventLike, ...args: unknown[]) => void): void;
}

export interface BridgeDeps extends ElectronCaptureDeps {
  ipcMain: IpcMainLike;
  /** The held PNG back to an image for the crop (main process: `nativeImage.createFromBuffer`). */
  decodePng: (png: Uint8Array) => FrameImage;
  /** True when the frame at `url` is one of Collide's own pages; any other sender is refused. */
  isTrusted: (url: string) => boolean;
  /** Send to every Collide window. */
  broadcast: (channel: string, ...args: unknown[]) => void;
  /** Defaults to the real capturer; tests and the T15 e2e pass a fake. */
  capturer?: Capturer;
  state?: CaptureState;
}

export const UNTRUSTED_SENDER = "This page may not use Collide's desktop features — restart Collide.";

/** The text the page gets for a failure: the error's own cause-and-fix message, as the Rust shell serialized it. */
export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function stubMessage(method: InvokeMethod): string {
  const task = (STUB_TASK as Partial<Record<InvokeMethod, string>>)[method];
  return `${method} is not available in this build yet — it arrives with ${task}.`;
}

/** Register every bridge channel. Returns the capture state (the held frame). */
export function registerBridge(deps: BridgeDeps): { state: CaptureState } {
  const state = deps.state ?? new CaptureState();
  const capturer = deps.capturer ?? electronCapturer(deps);
  const trusted = (event: IpcEventLike) => deps.isTrusted(event?.senderFrame?.url ?? "");

  const handle = (method: InvokeMethod, run: (...args: unknown[]) => unknown) => {
    deps.ipcMain.handle(INVOKE_CHANNELS[method], async (event, ...args): Promise<IpcReply> => {
      if (!trusted(event)) return { ok: false, error: UNTRUSTED_SENDER };
      try {
        return { ok: true, value: await run(...args) };
      } catch (e) {
        return { ok: false, error: errorText(e) };
      }
    });
  };

  handle("captureMonitor", () => captureMonitor(deps, state, capturer));
  handle("cropCapture", (box, scale) => cropFromState(state, box as LogicalRect, scale as number, deps.decodePng));

  for (const method of Object.keys(INVOKE_CHANNELS) as InvokeMethod[]) {
    if (IMPLEMENTED.includes(method)) continue;
    handle(method, () => {
      throw new Error(stubMessage(method));
    });
  }

  // Overlay events go to every window, the sender included (Tauri's emit did the same).
  deps.ipcMain.on(OVERLAY_EVENT_CHANNEL, (event, name, payload) => {
    if (!trusted(event) || !(OVERLAY_EVENTS as readonly unknown[]).includes(name)) return;
    deps.broadcast(OVERLAY_EVENT_CHANNEL, name, payload);
  });

  return { state };
}
