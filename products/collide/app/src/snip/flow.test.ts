import { describe, expect, it, vi } from "vitest";
import { createSnipFlow, NOT_DESKTOP, snipName, type OverlayResult, type SnipDeps } from "./flow";

const CAP = { width: 1920, height: 1080, x: -1920, y: 0, scaleFactor: 1.25, png: "data:image/png;base64,CAP" };
const CROP = { width: 50, height: 25, png: "data:image/png;base64,CROP" };

function setup(opts: { result?: OverlayResult | Promise<OverlayResult>; fail?: Record<string, Error>; ready?: () => Promise<void> } = {}) {
  const calls: string[] = [];
  const invoke = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    calls.push(cmd);
    void args;
    if (opts.fail?.[cmd]) throw opts.fail[cmd];
    if (cmd === "capture_monitor") return CAP;
    if (cmd === "crop_capture") return CROP;
    return undefined;
  });
  const deps: SnipDeps = {
    invoke,
    waitForOverlayReady: vi.fn(opts.ready ?? (async () => void calls.push("ready"))),
    readyTimeoutMs: 20,
    ackTimeoutMs: 20,
    sendFrame: vi.fn(async () => void calls.push("sendFrame")),
    waitForOverlayResult: vi.fn(() => opts.result instanceof Promise ? opts.result : Promise.resolve(opts.result ?? { kind: "cancel" as const })),
    openImage: vi.fn(async () => void calls.push("openImage")),
    notify: vi.fn(),
    now: () => new Date(2026, 10, 14, 9, 5),
    settle: async () => void calls.push("settle"),
  };
  return { calls, invoke, deps, flow: createSnipFlow(deps) };
}

describe("snip flow", () => {
  it("success: hides editor, captures, shows overlay on the monitor, crops, restores, opens the crop", async () => {
    const { calls, invoke, deps, flow } = setup({ result: { kind: "crop", box: { x: 10, y: 20, w: 40, h: 30 }, scale: 1.25 } });
    await flow.start();
    expect(calls).toEqual([
      "hide_editor", "settle", "capture_monitor", "ready", "sendFrame", "show_overlay",
      "crop_capture", "hide_overlay", "show_editor", "openImage",
    ]);
    expect(deps.sendFrame).toHaveBeenCalledWith(CAP.png, 1.25, 1920, 1080, 1);
    expect(deps.waitForOverlayResult).toHaveBeenCalledWith(1);
    expect(invoke).toHaveBeenCalledWith("show_overlay", { x: -1920, y: 0, width: 1920, height: 1080 });
    expect(invoke).toHaveBeenCalledWith("crop_capture", { x: 10, y: 20, w: 40, h: 30, scale: 1.25 });
    expect(deps.openImage).toHaveBeenCalledWith(CROP.png, "snip-2026-11-14-0905");
    expect(deps.notify).not.toHaveBeenCalled();
    expect(flow.isBusy()).toBe(false);
  });

  it("cancel: overlay hidden, editor shown, nothing opened, no toast", async () => {
    const { calls, deps, flow } = setup({ result: { kind: "cancel" } });
    await flow.start();
    expect(calls).toEqual(["hide_editor", "settle", "capture_monitor", "ready", "sendFrame", "show_overlay", "hide_overlay", "show_editor"]);
    expect(deps.openImage).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("capture error: toast with cause and fix, editor restored, overlay hidden", async () => {
    const { calls, deps, flow } = setup({ fail: { capture_monitor: new Error("Screen capture failed — check screen recording permission.") } });
    await flow.start();
    expect(deps.notify).toHaveBeenCalledTimes(1);
    const n = vi.mocked(deps.notify).mock.calls[0][0];
    expect(n.tone).toBe("error");
    expect(n.description).toContain("check screen recording permission");
    expect(n.description).toContain("try New snip again");
    expect(calls.slice(-2)).toEqual(["hide_overlay", "show_editor"]);
    expect(deps.openImage).not.toHaveBeenCalled();
    expect(flow.isBusy()).toBe(false);
  });

  it("crop error: same recovery, nothing opened", async () => {
    const { calls, deps, flow } = setup({
      result: { kind: "crop", box: { x: 0, y: 0, w: 5, h: 5 }, scale: 1 },
      fail: { crop_capture: new Error("The selection is outside the captured screen.") },
    });
    await flow.start();
    expect(vi.mocked(deps.notify).mock.calls[0][0].description).toContain("outside the captured screen");
    expect(calls.slice(-2)).toEqual(["hide_overlay", "show_editor"]);
    expect(deps.openImage).not.toHaveBeenCalled();
  });

  it("ready timeout: error toast, overlay never shown, overlay hidden and editor restored", async () => {
    const { calls, deps, flow, invoke } = setup({ ready: () => new Promise<void>(() => undefined) });
    await flow.start();
    expect(vi.mocked(deps.notify).mock.calls[0][0].description).toContain("overlay did not respond");
    expect(deps.sendFrame).not.toHaveBeenCalled();
    expect(invoke.mock.calls.some((c) => c[0] === "show_overlay")).toBe(false);
    expect(calls.slice(-2)).toEqual(["hide_overlay", "show_editor"]);
    expect(flow.isBusy()).toBe(false);
  });

  it("frame ack timeout: error toast and recovery, overlay never shown", async () => {
    const { calls, deps, flow, invoke } = setup();
    vi.mocked(deps.sendFrame).mockImplementation(() => new Promise<void>(() => undefined));
    await flow.start();
    expect(vi.mocked(deps.notify).mock.calls[0][0].description).toContain("did not confirm the frozen frame");
    expect(invoke.mock.calls.some((c) => c[0] === "show_overlay")).toBe(false);
    expect(calls.slice(-2)).toEqual(["hide_overlay", "show_editor"]);
  });

  it("show_overlay failure: toast and recovery, no unhandled rejection", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const { calls, deps, flow } = setup({ fail: { show_overlay: new Error("Could not show the overlay.") } });
    vi.mocked(deps.waitForOverlayResult).mockImplementation(() => Promise.reject(new Error("late")));
    await flow.start();
    await new Promise((r) => setTimeout(r, 10));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(vi.mocked(deps.notify).mock.calls[0][0].description).toContain("Could not show the overlay");
    expect(calls.slice(-2)).toEqual(["hide_overlay", "show_editor"]);
  });

  it("a string rejection (Tauri errors are strings) still produces a readable toast", async () => {
    const { deps, flow, invoke } = setup();
    invoke.mockRejectedValueOnce("No monitor found under the cursor — try again.");
    await flow.start();
    expect(vi.mocked(deps.notify).mock.calls[0][0].description).toContain("No monitor found");
  });

  it("re-entrancy: a second start while one is in progress is ignored; a later one works", async () => {
    let finish!: (r: OverlayResult) => void;
    const { invoke, flow } = setup({ result: new Promise<OverlayResult>((r) => (finish = r)) });
    const first = flow.start();
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("show_overlay", expect.anything()));
    expect(flow.isBusy()).toBe(true);
    const before = invoke.mock.calls.length;
    await flow.start();
    await flow.start();
    expect(invoke.mock.calls.length).toBe(before);
    finish({ kind: "cancel" });
    await first;
    expect(flow.isBusy()).toBe(false);
    expect(invoke.mock.calls.filter((c) => c[0] === "capture_monitor")).toHaveLength(1);
    await flow.start();
    expect(invoke.mock.calls.filter((c) => c[0] === "capture_monitor")).toHaveLength(2);
  });

  it("snipId increases per snip and is passed to frame and result waits", async () => {
    const { deps, flow } = setup();
    await flow.start();
    await flow.start();
    expect(vi.mocked(deps.sendFrame).mock.calls.map((c) => c[4])).toEqual([1, 2]);
    expect(vi.mocked(deps.waitForOverlayResult).mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });

  it("outside the desktop app: clear toast, nothing invoked", async () => {
    const { deps } = setup();
    const flow = createSnipFlow({ ...deps, invoke: undefined });
    await flow.start();
    expect(deps.notify).toHaveBeenCalledWith(NOT_DESKTOP);
  });

  it("names snips snip-YYYY-MM-DD-HHMM", () => {
    expect(snipName(new Date(2026, 0, 2, 3, 4))).toBe("snip-2026-01-02-0304");
  });
});
