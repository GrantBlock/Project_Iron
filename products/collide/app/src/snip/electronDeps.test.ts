import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollideBridge, OverlayEvent } from "../native/bridge";
import { electronDeps, invokeOn, isDesktop } from "./electronDeps";
import { createSnipFlow, NOT_DESKTOP } from "./flow";

const handlers = new Map<string, Set<(payload: unknown) => void>>();
const emitted: [string, unknown][] = [];
const calls: [string, ...unknown[]][] = [];

/** A stand-in for the preload bridge: records calls and lets the test fire overlay events. */
function fakeBridge(): CollideBridge {
  const method =
    (name: string, value?: unknown) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args]);
      return value;
    };
  return {
    captureMonitor: method("captureMonitor", { width: 1, height: 1, x: 0, y: 0, scaleFactor: 1, png: "p" }),
    cropCapture: method("cropCapture", { width: 1, height: 1, png: "c" }),
    hideEditor: method("hideEditor"),
    showEditor: method("showEditor"),
    showOverlay: method("showOverlay"),
    hideOverlay: method("hideOverlay"),
    copyImage: method("copyImage"),
    settingsStatus: method("settingsStatus", null),
    onSnipRequest: () => () => undefined,
    markups: { save: method("markups.save"), open: method("markups.open"), pick: method("markups.pick"), list: method("markups.list") },
    overlay: {
      emit: (event: OverlayEvent, payload?: unknown) => void emitted.push([event, payload]),
      on: (event: OverlayEvent, cb: (payload: unknown) => void) => {
        const set = handlers.get(event) ?? new Set();
        handlers.set(event, set);
        set.add(cb);
        return () => void set.delete(cb);
      },
    },
  } as unknown as CollideBridge;
}

const fire = (name: string, payload: unknown) => handlers.get(name)?.forEach((h) => h(payload));
const listening = (name: string) => (handlers.get(name)?.size ?? 0) > 0;
const deps = () => electronDeps({ openImage: vi.fn(), notify: vi.fn() });

beforeEach(() => {
  handlers.clear();
  emitted.length = 0;
  calls.length = 0;
  window.collide = fakeBridge();
});
afterEach(() => {
  delete window.collide;
});

describe("electronDeps snipId filtering", () => {
  it("sendFrame resolves only on the ack for its own snipId", async () => {
    const p = deps().sendFrame("png", 1, 10, 10, 2);
    let done = false;
    void p.then(() => (done = true));
    await vi.waitFor(() => expect(emitted.some(([n]) => n === "collide:overlay-frame")).toBe(true));
    expect(emitted.find(([n]) => n === "collide:overlay-frame")![1]).toMatchObject({ snipId: 2 });
    fire("collide:overlay-frame-ack", { snipId: 1 }); // stale
    fire("collide:overlay-frame-ack", {}); // id-less
    await new Promise((r) => setTimeout(r, 5));
    expect(done).toBe(false);
    fire("collide:overlay-frame-ack", { snipId: 2 });
    await p;
    expect(done).toBe(true);
  });

  it("waitForOverlayResult ignores stale and id-less results", async () => {
    const p = deps().waitForOverlayResult(5);
    await vi.waitFor(() => expect(listening("collide:overlay-result")).toBe(true));
    fire("collide:overlay-result", { kind: "cancel", snipId: 4 });
    fire("collide:overlay-result", { kind: "cancel" });
    fire("collide:overlay-result", { kind: "crop", box: { x: 1, y: 1, w: 2, h: 2 }, scale: 1, snipId: 5 });
    await expect(p).resolves.toMatchObject({ kind: "crop", snipId: 5 });
  });
});

describe("electronDeps overlay handshake", () => {
  it("the frame goes out with its scale, physical size and snipId, after the ack listener is live", async () => {
    const p = deps().sendFrame("data:image/png;base64,F", 1.5, 2880, 1620, 9);
    expect(listening("collide:overlay-frame-ack")).toBe(true);
    expect(emitted).toEqual([["collide:overlay-frame", { png: "data:image/png;base64,F", scale: 1.5, width: 2880, height: 1620, snipId: 9 }]]);
    fire("collide:overlay-frame-ack", { snipId: 9 });
    await p;
    expect(listening("collide:overlay-frame-ack")).toBe(false); // one-shot: the listener is gone
  });

  it("waitForOverlayReady listens first, then pings; a ready ends the wait", async () => {
    const order: string[] = [];
    const bridge = window.collide!;
    const { on, emit } = bridge.overlay;
    bridge.overlay.on = (event, cb) => {
      order.push(`on:${event}`);
      return on(event, cb);
    };
    bridge.overlay.emit = (event, payload) => {
      order.push(`emit:${event}`);
      emit(event, payload);
    };
    const p = deps().waitForOverlayReady();
    await vi.waitFor(() => expect(order).toEqual(["on:collide:overlay-ready", "emit:collide:overlay-ping"]));
    fire("collide:overlay-ready", undefined);
    await p;
    expect(listening("collide:overlay-ready")).toBe(false);
  });
});

describe("electronDeps invoke: the flow's commands on the bridge", () => {
  it("each command calls its bridge method with the bridge's argument shape", async () => {
    const invoke = deps().invoke!;
    await invoke("hide_editor");
    expect(await invoke("capture_monitor")).toMatchObject({ png: "p" });
    await invoke("show_overlay", { x: -1920, y: 0, width: 1920, height: 1080 });
    expect(await invoke("crop_capture", { x: 10, y: 5, w: 40, h: 20, scale: 1.25 })).toMatchObject({ png: "c" });
    await invoke("hide_overlay");
    await invoke("show_editor");
    expect(calls).toEqual([
      ["hideEditor"],
      ["captureMonitor"],
      ["showOverlay", { x: -1920, y: 0, width: 1920, height: 1080 }],
      ["cropCapture", { x: 10, y: 5, w: 40, h: 20 }, 1.25],
      ["hideOverlay"],
      ["showEditor"],
    ]);
  });

  it("an unknown command is refused and reaches nothing", async () => {
    await expect(invokeOn(window.collide!, "get_settings_status")).rejects.toThrow('Unknown desktop command "get_settings_status"');
    expect(calls).toEqual([]);
  });

  it("a bridge failure reaches the flow as the shell's own message", async () => {
    window.collide!.captureMonitor = async () => {
      throw new Error("Screen capture failed — check screen recording permission and try again. (denied)");
    };
    await expect(deps().invoke!("capture_monitor")).rejects.toThrow("Screen capture failed — check screen recording permission");
  });
});

describe("isDesktop", () => {
  it("is true only when the preload bridge is on the page", () => {
    expect(isDesktop()).toBe(true);
    delete window.collide;
    expect(isDesktop()).toBe(false);
  });

  it("without the bridge there is no invoke, so the flow shows its desktop-app toast", async () => {
    delete window.collide;
    const notify = vi.fn();
    const d = electronDeps({ openImage: vi.fn(), notify });
    expect(d.invoke).toBeUndefined();
    await createSnipFlow(d).start();
    expect(notify).toHaveBeenCalledWith(NOT_DESKTOP);
    await expect(d.waitForOverlayReady()).rejects.toThrow("desktop shell is not available");
  });
});
