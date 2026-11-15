// T14/T15/T16: the main-process side of the bridge, with a fake ipcMain, a fake capturer, fake windows and a fake markup store.
import { describe, expect, it } from "vitest";
import { INVOKE_CHANNELS, OVERLAY_EVENT_CHANNEL, OVERLAY_EVENTS, type InvokeMethod, type IpcReply, type SettingsStatus } from "./bridge";
import { CaptureError, type Capturer } from "./capture";
import { registerBridge, UNTRUSTED_SENDER, type IpcEventLike } from "./ipc";
import { MarkupStoreError } from "./markups";
import type { CaptureInfo, CropInfo } from "../snip/flow";
import { decodeDataUrl, decodePng, TestImage } from "./testImage";

const APP = "collide://app/";
const fromApp: IpcEventLike = { senderFrame: { url: APP } };
const PNG = "data:image/png;base64,iVBORw0KGgo=";

function setup(capturer?: Capturer, settings: SettingsStatus | null = { hotkey: "Ctrl+Alt+S", warning: null }) {
  const moves: unknown[][] = [];
  const copied: unknown[] = [];
  const stored: unknown[][] = [];
  const handlers = new Map<string, (event: IpcEventLike, ...args: unknown[]) => unknown>();
  const listeners = new Map<string, (event: IpcEventLike, ...args: unknown[]) => void>();
  const sent: unknown[][] = [];
  const monitor = { x: -90, y: -60, width: 90, height: 60, scaleFactor: 1.5 };
  const { state } = registerBridge({
    ipcMain: {
      handle: (channel, listener) => {
        if (handlers.has(channel)) throw new Error(`second handler for ${channel}`);
        handlers.set(channel, listener);
      },
      on: (channel, listener) => void listeners.set(channel, listener),
    },
    screen: {
      getCursorScreenPoint: () => ({ x: -10, y: -10 }),
      getDisplayNearestPoint: () => {
        throw new Error("the fake capturer is used instead");
      },
    },
    desktopCapturer: { getSources: async () => [] },
    decodePng,
    isTrusted: (url) => url === APP,
    broadcast: (...args) => void sent.push(args),
    windows: {
      hideEditor: async () => void moves.push(["hideEditor"]),
      showEditor: () => void moves.push(["showEditor"]),
      showOverlay: (bounds) => void moves.push(["showOverlay", bounds]),
      hideOverlay: () => {
        throw new Error("The overlay window is missing — restart Collide.");
      },
    },
    copyImage: (png) => {
      if (png !== PNG) throw new Error("The image to copy is not a PNG — try Copy again, or use Export instead.");
      copied.push(png);
    },
    settingsStatus: () => settings,
    markups: {
      save: (folderName, files) => {
        stored.push(["save", folderName, files]);
        if (folderName !== "2026-11-15_snip") throw new MarkupStoreError("InvalidFolderName", String(folderName));
        return `/docs/Collide/Markups/${folderName}`;
      },
      open: (folder) => {
        stored.push(["open", folder]);
        if (folder !== "/docs/Collide/Markups/2026-11-15_snip") throw new MarkupStoreError("OutsideMarkups", String(folder));
        return { sourcePng: new Uint8Array([137, 80]), annotations: "{}" };
      },
      pick: async () => {
        stored.push(["pick"]);
        return null;
      },
      list: () => {
        stored.push(["list"]);
        return ["/docs/Collide/Markups/2026-11-15_snip"];
      },
    },
    capturer: capturer ?? { captureAt: async () => ({ image: TestImage.marked(90, 60), monitor, display: { id: 2, bounds: { x: -60, y: -40, width: 60, height: 40 } } }) },
  });
  const invoke = <T>(method: InvokeMethod, event: IpcEventLike, ...args: unknown[]) =>
    handlers.get(INVOKE_CHANNELS[method])!(event, ...args) as Promise<IpcReply<T>>;
  return { handlers, listeners, sent, state, invoke, moves, copied, stored };
}

describe("registerBridge", () => {
  it("handles exactly the invoke channels of the bridge, plus the overlay event channel", () => {
    const { handlers, listeners } = setup();
    expect([...handlers.keys()].sort()).toEqual(Object.values(INVOKE_CHANNELS).sort());
    expect([...listeners.keys()]).toEqual([OVERLAY_EVENT_CHANNEL]);
  });

  it("captureMonitor then cropCapture: the chain the snip uses, over the channels", async () => {
    const { invoke, state } = setup();
    const cap = await invoke<CaptureInfo>("captureMonitor", fromApp);
    if (!cap.ok) throw new Error(cap.error);
    expect([cap.value.width, cap.value.height, cap.value.x, cap.value.y, cap.value.scaleFactor]).toEqual([90, 60, -90, -60, 1.5]);
    expect(decodeDataUrl(cap.value.png).getSize()).toEqual({ width: 90, height: 60 });
    expect(state.frame).not.toBeNull();

    const crop = await invoke<CropInfo>("cropCapture", fromApp, { x: 10, y: 8, w: 20, h: 10 }, 1.5);
    if (!crop.ok) throw new Error(crop.error);
    expect([crop.value.width, crop.value.height]).toEqual([30, 15]);
    const img = decodeDataUrl(crop.value.png);
    expect(img.pixel(0, 0)).toEqual([15, 12, 7, 255]);
    expect(img.pixel(29, 14)).toEqual([44, 26, 7, 255]);
  });

  it("failures come back as the cause-and-fix message, not as a thrown error", async () => {
    const { invoke } = setup();
    expect(await invoke("cropCapture", fromApp, { x: 0, y: 0, w: 10, h: 10 }, 1)).toEqual({ ok: false, error: "No capture to crop — start a new snip." });
    await invoke("captureMonitor", fromApp);
    expect(await invoke("cropCapture", fromApp, { x: 0, y: 0, w: 0, h: 10 }, 1)).toEqual({
      ok: false,
      error: "The selection has no width or height — drag a larger box and release again.",
    });
    expect(await invoke("cropCapture", fromApp, "box", "1")).toEqual({
      ok: false,
      error: "The selection or display scale is not a valid number — start a new snip.",
    });
    expect(await invoke("cropCapture", fromApp)).toMatchObject({ ok: false });

    const failing = setup({
      captureAt: async () => {
        throw new CaptureError("CaptureFailed", "denied");
      },
    });
    expect(await failing.invoke("captureMonitor", fromApp)).toEqual({
      ok: false,
      error: "Screen capture failed — check screen recording permission and try again. (denied)",
    });
    expect(failing.state.frame).toBeNull();
  });

  it("T16: no stubs are left; the markups channels reach the store with the page's arguments, and its typed errors come back as messages", async () => {
    const { invoke, stored } = setup();
    const files = { sourcePng: new Uint8Array([1]), annotations: "{}", exportPng: new Uint8Array([2]) };
    expect(await invoke("markups.save", fromApp, "2026-11-15_snip", files)).toEqual({ ok: true, value: "/docs/Collide/Markups/2026-11-15_snip" });
    expect(await invoke("markups.open", fromApp, "/docs/Collide/Markups/2026-11-15_snip")).toEqual({ ok: true, value: { sourcePng: new Uint8Array([137, 80]), annotations: "{}" } });
    expect(await invoke("markups.pick", fromApp)).toEqual({ ok: true, value: null });
    expect(await invoke("markups.list", fromApp)).toEqual({ ok: true, value: ["/docs/Collide/Markups/2026-11-15_snip"] });
    expect(stored).toEqual([["save", "2026-11-15_snip", files], ["open", "/docs/Collide/Markups/2026-11-15_snip"], ["pick"], ["list"]]);

    expect(await invoke("markups.open", fromApp, "/etc")).toEqual({
      ok: false,
      error: "/etc is outside Documents/Collide/Markups. Pick a folder inside Documents/Collide/Markups.",
    });
    expect(await invoke("markups.save", fromApp, "../up", files)).toMatchObject({ ok: false, error: expect.stringContaining('"../up" cannot be used as a markup folder name') });
    // Every channel answers with real behaviour: none says "not available in this build".
    for (const method of Object.keys(INVOKE_CHANNELS) as InvokeMethod[]) {
      const reply = await invoke(method, fromApp);
      expect(reply.ok ? "" : reply.error, method).not.toMatch(/not available in this build/);
    }
  });

  it("T15: the window moves reach the choreography; the overlay goes on the captured display", async () => {
    const { invoke, moves } = setup();
    expect(await invoke("hideEditor", fromApp)).toEqual({ ok: true, value: undefined });
    const cap = await invoke<CaptureInfo>("captureMonitor", fromApp);
    if (!cap.ok) throw new Error(cap.error);
    const { x, y, width, height } = cap.value;
    // The flow passes the monitor in physical px; the overlay gets the captured display's own bounds.
    expect(await invoke("showOverlay", fromApp, { x, y, width, height })).toEqual({ ok: true, value: undefined });
    expect(await invoke("showEditor", fromApp)).toEqual({ ok: true, value: undefined });
    expect(moves).toEqual([["hideEditor"], ["showOverlay", { x: -60, y: -40, width: 60, height: 40 }], ["showEditor"]]);
    // A window failure comes back as its cause-and-fix message.
    expect(await invoke("hideOverlay", fromApp)).toEqual({ ok: false, error: "The overlay window is missing — restart Collide." });
    // Bounds that are not a rectangle never reach a window.
    for (const bad of [undefined, {}, { x: 0, y: 0, width: 0, height: 10 }, { x: "0", y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: Infinity, height: 10 }]) {
      expect(await invoke("showOverlay", fromApp, bad)).toEqual({ ok: false, error: "The overlay position is not valid — start a new snip." });
    }
    expect(moves).toHaveLength(3);
  });

  it("T15: copyImage and settingsStatus", async () => {
    const { invoke, copied } = setup();
    expect(await invoke("copyImage", fromApp, PNG)).toEqual({ ok: true, value: undefined });
    expect(copied).toEqual([PNG]);
    expect(await invoke("copyImage", fromApp, "hello")).toEqual({ ok: false, error: "The image to copy is not a PNG — try Copy again, or use Export instead." });
    expect(await invoke("settingsStatus", fromApp)).toEqual({ ok: true, value: { hotkey: "Ctrl+Alt+S", warning: null } });
    const warned = setup(undefined, { hotkey: "Ctrl+Alt+S", warning: "Hotkey setting ignored: Win+Shift+S is reserved by Windows." });
    expect(await warned.invoke("settingsStatus", fromApp)).toMatchObject({ ok: true, value: { warning: expect.stringContaining("reserved by Windows") } });
    expect(await setup(undefined, null).invoke("settingsStatus", fromApp)).toEqual({ ok: true, value: null });
  });

  it("refuses any sender that is not one of Collide's own pages", async () => {
    const { invoke, state, listeners, sent, moves, copied, stored } = setup();
    for (const event of [{ senderFrame: { url: "https://example.com/" } }, { senderFrame: null }, {}] as IpcEventLike[]) {
      expect(await invoke("captureMonitor", event)).toEqual({ ok: false, error: UNTRUSTED_SENDER });
      for (const method of ["hideEditor", "showEditor", "showOverlay", "hideOverlay", "copyImage", "settingsStatus", "markups.save", "markups.open", "markups.pick", "markups.list"] as const) {
        expect(await invoke(method, event, PNG), method).toEqual({ ok: false, error: UNTRUSTED_SENDER });
      }
      listeners.get(OVERLAY_EVENT_CHANNEL)!(event, "collide:overlay-ping", undefined);
    }
    expect(state.frame).toBeNull();
    expect(sent).toEqual([]);
    expect(moves).toEqual([]);
    expect(copied).toEqual([]);
    expect(stored).toEqual([]);
  });

  it("relays the overlay events to every window and nothing else", () => {
    const { listeners, sent } = setup();
    const relay = listeners.get(OVERLAY_EVENT_CHANNEL)!;
    for (const name of OVERLAY_EVENTS) relay(fromApp, name, { snipId: 3 });
    expect(sent).toEqual(OVERLAY_EVENTS.map((name) => [OVERLAY_EVENT_CHANNEL, name, { snipId: 3 }]));
    sent.length = 0;
    for (const name of ["collide:snip-request", "collide:capture-monitor", "", undefined, 7]) relay(fromApp, name, {});
    expect(sent).toEqual([]);
  });
});
