import { describe, expect, it, vi } from "vitest";
import { createOverlayBridge, EV_ACK, EV_RESULT } from "./bridge";

function setup(decode: () => Promise<void> = async () => undefined) {
  const log: string[] = [];
  const emit = vi.fn((e: string) => void log.push(`emit:${e}`));
  const setFrame = vi.fn(() => void log.push("setFrame"));
  return { log, emit, setFrame, bridge: createOverlayBridge({ decode, setFrame, emit }) };
}

describe("overlay bridge", () => {
  it("decodes, sets the frame, then acks with the snipId, with no animation frame involved", async () => {
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    const { log, emit, setFrame, bridge } = setup();
    await bridge.onFrame({ png: "p", scale: 1.5, width: 2880, snipId: 7 });
    expect(log).toEqual(["setFrame", `emit:${EV_ACK}`]);
    expect(setFrame).toHaveBeenCalledWith("p", 1.5, 2880);
    expect(emit).toHaveBeenCalledWith(EV_ACK, { snipId: 7 });
    expect(raf).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("a failed decode sets nothing and sends no ack", async () => {
    const { emit, setFrame, bridge } = setup(async () => {
      throw new Error("bad image");
    });
    await bridge.onFrame({ png: "p", scale: 1, snipId: 1 });
    expect(setFrame).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("results carry the current snipId", async () => {
    const { emit, bridge } = setup();
    await bridge.onFrame({ png: "p", scale: 1, snipId: 3 });
    bridge.onResult({ kind: "crop", box: { x: 1, y: 2, w: 3, h: 4 }, scale: 1 });
    expect(emit).toHaveBeenLastCalledWith(EV_RESULT, { kind: "crop", box: { x: 1, y: 2, w: 3, h: 4 }, scale: 1, snipId: 3 });
    await bridge.onFrame({ png: "q", scale: 1, snipId: 4 });
    bridge.onResult({ kind: "cancel" });
    expect(emit).toHaveBeenLastCalledWith(EV_RESULT, { kind: "cancel", snipId: 4 });
  });

  it("Esc with no frame set emits a cancel with no snipId (the flow ignores it)", () => {
    const { emit, bridge } = setup();
    bridge.onResult({ kind: "cancel" });
    expect(emit).toHaveBeenCalledWith(EV_RESULT, { kind: "cancel", snipId: undefined });
  });
});
