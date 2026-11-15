// T14: the main-process side of the bridge, with a fake ipcMain and a fake capturer.
import { describe, expect, it } from "vitest";
import { IMPLEMENTED, INVOKE_CHANNELS, OVERLAY_EVENT_CHANNEL, OVERLAY_EVENTS, STUB_TASK, type InvokeMethod, type IpcReply } from "./bridge";
import { CaptureError, type Capturer } from "./capture";
import { registerBridge, UNTRUSTED_SENDER, type IpcEventLike } from "./ipc";
import type { CaptureInfo, CropInfo } from "../snip/flow";
import { decodeDataUrl, decodePng, TestImage } from "./testImage";

const APP = "collide://app/";
const fromApp: IpcEventLike = { senderFrame: { url: APP } };

function setup(capturer?: Capturer) {
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
    capturer: capturer ?? { captureAt: async () => ({ image: TestImage.marked(90, 60), monitor }) },
  });
  const invoke = <T>(method: InvokeMethod, event: IpcEventLike, ...args: unknown[]) =>
    handlers.get(INVOKE_CHANNELS[method])!(event, ...args) as Promise<IpcReply<T>>;
  return { handlers, listeners, sent, state, invoke };
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

  it("every method that is not implemented yet is a stub that names its task", async () => {
    const { invoke } = setup();
    const stubs = (Object.keys(INVOKE_CHANNELS) as InvokeMethod[]).filter((m) => !IMPLEMENTED.includes(m));
    expect(stubs.sort()).toEqual(Object.keys(STUB_TASK).sort());
    expect(stubs).toHaveLength(10);
    for (const method of stubs) {
      const task = STUB_TASK[method as keyof typeof STUB_TASK];
      expect(await invoke(method, fromApp)).toEqual({ ok: false, error: `${method} is not available in this build yet — it arrives with ${task}.` });
    }
    expect(STUB_TASK.hideEditor).toBe("T15");
    expect(STUB_TASK["markups.save"]).toBe("T16");
  });

  it("refuses any sender that is not one of Collide's own pages", async () => {
    const { invoke, state, listeners, sent } = setup();
    for (const event of [{ senderFrame: { url: "https://example.com/" } }, { senderFrame: null }, {}] as IpcEventLike[]) {
      expect(await invoke("captureMonitor", event)).toEqual({ ok: false, error: UNTRUSTED_SENDER });
      listeners.get(OVERLAY_EVENT_CHANNEL)!(event, "collide:overlay-ping", undefined);
    }
    expect(state.frame).toBeNull();
    expect(sent).toEqual([]);
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
