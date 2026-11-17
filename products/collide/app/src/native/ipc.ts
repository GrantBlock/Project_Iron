// T14: the main-process side of `window.collide`. `registerBridge` wires every
// channel of the preload bridge; Electron's modules are passed in, so the whole
// table is unit-tested with a fake `ipcMain`.
//
// Real: captureMonitor, cropCapture and the overlay event relay (T14); the window
// moves, copyImage and settingsStatus (T15); markups.* (T16, markups.ts).

import {
  INVOKE_CHANNELS,
  OVERLAY_EVENT_CHANNEL,
  OVERLAY_EVENTS,
  type InvokeMethod,
  type IpcReply,
  type SettingsStatus,
} from "./bridge";
import { CaptureState, cropFromState, type Capturer, type FrameImage } from "./capture";
import { captureMonitor, electronCapturer, type ElectronCaptureDeps } from "./electronCapturer";
import type { Markups } from "./markups";
import type { CollideFiles } from "./collideFiles";
import { overlayBoundsFor, type Choreography } from "./windows";
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
  /** The snip's window moves (windows.ts). */
  windows: Choreography;
  /** Put a PNG data URL on the clipboard as an image; throws with the cause and the fix. */
  copyImage: (png: unknown) => void;
  /** What loading settings.json and registering the hotkey gave; null before that has run. */
  settingsStatus: () => SettingsStatus | null;
  /** The collapsed window's size (collapse.ts). The argument comes from the page. */
  collapse: (request: unknown) => { maximized: boolean };
  /** Markup folders, scoped to Documents/Collide/Markups (markups.ts). */
  markups: Markups;
  /** RUN3 T35: Collide files, scoped to the same folder (collideFiles.ts). Absent = the channels answer that this build cannot. */
  collideFiles?: CollideFiles;
  /** Defaults to the real capturer; tests and the Electron e2e pass a fake. */
  capturer?: Capturer;
  state?: CaptureState;
}

export const UNTRUSTED_SENDER = "This page may not use Collide's desktop features — restart Collide.";

/** The text the page gets for a failure: the error's own cause-and-fix message, as the Rust shell serialized it. */
export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
  handle("hideEditor", () => deps.windows.hideEditor());
  handle("showEditor", () => deps.windows.showEditor());
  handle("showOverlay", (bounds) => deps.windows.showOverlay(overlayBoundsFor(state.frame, bounds)));
  handle("hideOverlay", () => deps.windows.hideOverlay());
  handle("copyImage", (png) => deps.copyImage(png));
  handle("settingsStatus", () => deps.settingsStatus());
  handle("collapse", (request) => deps.collapse(request));

  // The arguments come from the page: markups.ts checks their types and every path.
  handle("markups.save", (folderName, files) => deps.markups.save(folderName, files));
  handle("markups.open", (folder) => deps.markups.open(folder));
  handle("markups.pick", () => deps.markups.pick());
  handle("markups.list", () => deps.markups.list());
  handle("markups.remove", (folder) => deps.markups.remove(folder));

  // RUN3 T35: Collide files. collideFiles.ts checks the arguments and every path.
  const files = (): CollideFiles => {
    if (!deps.collideFiles) throw new Error("This build of Collide cannot save or open Collide files. Update Collide.");
    return deps.collideFiles;
  };
  handle("collideFiles.save", (name, bytes, replace) => files().save(name, bytes, replace));
  handle("collideFiles.open", (file) => files().open(file));
  handle("collideFiles.pick", () => files().pick());

  // Overlay events go to every window, the sender included (the Rust shell's emit did the same).
  deps.ipcMain.on(OVERLAY_EVENT_CHANNEL, (event, name, payload) => {
    if (!trusted(event) || !(OVERLAY_EVENTS as readonly unknown[]).includes(name)) return;
    deps.broadcast(OVERLAY_EVENT_CHANNEL, name, payload);
  });

  return { state };
}
