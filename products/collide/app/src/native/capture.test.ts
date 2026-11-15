// T14: the 3 tests of the Rust shell's capture.rs, ported one for one with a fake
// capturer (same names), then the cases the Node port adds.
import { describe, expect, it } from "vitest";
import { captureInto, CaptureError, CaptureState, cropFromState, encodePng, type Capture, type CaptureErrorKind, type Capturer, type MonitorInfo } from "./capture";
import { errorText } from "./ipc";
import { decodeDataUrl, decodePng, TestImage } from "./testImage";

/** Fake capturer: a blank frame of the given size from `monitor`, or a failure. */
function fake(outcome: { width: number; height: number; monitor: MonitorInfo } | Error): Capturer {
  return {
    captureAt: async (): Promise<Capture> => {
      if (outcome instanceof Error) throw outcome;
      return { image: TestImage.blank(outcome.width, outcome.height), monitor: outcome.monitor };
    },
  };
}

const mon = (x: number, y: number, width: number, height: number): MonitorInfo => ({ x, y, width, height, scaleFactor: 1.5 });

async function captureError(p: Promise<unknown>): Promise<CaptureError> {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(CaptureError);
  return err as CaptureError;
}

describe("capture.rs tests, ported", () => {
  it("success_returns_png_of_monitor_size_and_stores_frame", async () => {
    const m = mon(-1920, 0, 64, 48);
    const state = new CaptureState();
    const r = await captureInto(fake({ width: 64, height: 48, monitor: m }), state, { x: -10, y: 5 });
    expect([r.width, r.height, r.x, r.y, r.scaleFactor]).toEqual([64, 48, -1920, 0, 1.5]);
    expect(r.png.startsWith("data:image/png;base64,")).toBe(true);
    const img = decodeDataUrl(r.png);
    expect(img.getSize()).toEqual({ width: 64, height: 48 });
    const f = state.frame;
    expect(f).not.toBeNull();
    expect(f!.monitor).toEqual(m);
    expect(decodePng(f!.png).getSize()).toEqual({ width: 64, height: 48 });
  });

  it("failure_returns_typed_error_and_leaves_state_unchanged", async () => {
    const state = new CaptureState();
    const old = mon(0, 0, 8, 8);
    const oldFrame = { png: TestImage.blank(8, 8).toPNG(), monitor: old };
    state.frame = oldFrame;
    const err = await captureError(captureInto(fake(new CaptureError("CaptureFailed", "denied")), state, { x: 0, y: 0 }));
    expect(err.kind).toBe("CaptureFailed");
    expect(err.detail).toBe("denied");
    const msg = err.message;
    expect(msg).toContain("failed");
    expect(msg).toContain("check screen recording permission");
    expect(state.frame).toBe(oldFrame);
    expect(state.frame!.monitor).toEqual(old);
    // Empty state stays empty too.
    const empty = new CaptureState();
    expect((await captureError(captureInto(fake(new CaptureError("NoMonitor")), empty, { x: 0, y: 0 }))).kind).toBe("NoMonitor");
    expect(empty.frame).toBeNull();
  });

  it("error_serializes_to_cause_and_fix_message", () => {
    // The page gets the error as its message text (see ipc.ts), as serde gave the Rust one.
    expect(errorText(new CaptureError("NoMonitor"))).toContain("try again");
  });
});

describe("capture, Node port", () => {
  it("every error kind carries the Rust message (cause and fix)", () => {
    const messages: Record<CaptureErrorKind, string> = {
      CursorUnavailable: "Could not read the cursor position — move the mouse and try again.",
      NoMonitor: "No monitor found under the cursor — check your display setup and try again.",
      CaptureFailed: "Screen capture failed — check screen recording permission and try again. (denied)",
      EncodeFailed: "Could not encode the captured frame as PNG — try again; if it repeats, restart Collide. (denied)",
      StateUnavailable: "Capture state is locked by a failed earlier capture — restart Collide.",
    };
    for (const kind of Object.keys(messages) as CaptureErrorKind[]) {
      const err = new CaptureError(kind, "denied");
      expect(err.message).toBe(messages[kind]);
      expect(errorText(err)).toBe(messages[kind]);
    }
  });

  it("passes the cursor point to the capturer", async () => {
    const seen: number[][] = [];
    const capturer: Capturer = {
      captureAt: async (x, y) => {
        seen.push([x, y]);
        return { image: TestImage.blank(2, 2), monitor: mon(0, 0, 2, 2) };
      },
    };
    await captureInto(capturer, new CaptureState(), { x: -10, y: 5 });
    expect(seen).toEqual([[-10, 5]]);
  });

  it("holds exactly the PNG it returned, and the pixels survive", async () => {
    const monitor = mon(0, 0, 20, 10);
    const state = new CaptureState();
    const r = await captureInto({ captureAt: async () => ({ image: TestImage.marked(20, 10), monitor }) }, state, { x: 0, y: 0 });
    expect(decodePng(state.frame!.png)).toEqual(decodeDataUrl(r.png));
    expect(decodeDataUrl(r.png).pixel(19, 9)).toEqual([19, 9, 7, 255]);
  });

  it("a frame that cannot be encoded is EncodeFailed and leaves the state unchanged", async () => {
    const state = new CaptureState();
    const oldFrame = { png: TestImage.blank(8, 8).toPNG(), monitor: mon(0, 0, 8, 8) };
    state.frame = oldFrame;
    const broken = (toPNG: () => Uint8Array): Capturer => ({
      captureAt: async () => ({ image: { ...TestImage.blank(4, 4), getSize: () => ({ width: 4, height: 4 }), crop: () => TestImage.blank(1, 1), toPNG }, monitor: mon(0, 0, 4, 4) }),
    });
    const thrown = await captureError(
      captureInto(
        broken(() => {
          throw new Error("out of memory");
        }),
        state,
        { x: 0, y: 0 },
      ),
    );
    expect(thrown.kind).toBe("EncodeFailed");
    expect(thrown.message).toBe("Could not encode the captured frame as PNG — try again; if it repeats, restart Collide. (out of memory)");
    const empty = await captureError(captureInto(broken(() => new Uint8Array(0)), state, { x: 0, y: 0 }));
    expect(empty.kind).toBe("EncodeFailed");
    expect(state.frame).toBe(oldFrame);
    expect(() => encodePng(TestImage.blank(1, 1))).not.toThrow();
  });

  it("an untyped capturer failure becomes CaptureFailed with its cause", async () => {
    const state = new CaptureState();
    const err = await captureError(captureInto(fake(new Error("pipe closed")), state, { x: 0, y: 0 }));
    expect(err.kind).toBe("CaptureFailed");
    expect(err.message).toBe("Screen capture failed — check screen recording permission and try again. (pipe closed)");
    expect(state.frame).toBeNull();
  });

  it("a newer capture replaces the held frame; a failed one after it does not", async () => {
    const state = new CaptureState();
    await captureInto(fake({ width: 8, height: 8, monitor: mon(0, 0, 8, 8) }), state, { x: 0, y: 0 });
    await captureInto(fake({ width: 16, height: 4, monitor: mon(-16, 0, 16, 4) }), state, { x: -1, y: 0 });
    expect(state.frame!.monitor).toEqual(mon(-16, 0, 16, 4));
    await captureError(captureInto(fake(new CaptureError("NoMonitor")), state, { x: 0, y: 0 }));
    expect(decodePng(state.frame!.png).getSize()).toEqual({ width: 16, height: 4 });
  });

  it("a held frame that cannot be read back is NoCapture (start a new snip)", () => {
    const state = new CaptureState();
    state.frame = { png: new Uint8Array([1, 2, 3]), monitor: mon(0, 0, 8, 8) };
    expect(() => cropFromState(state, { x: 0, y: 0, w: 4, h: 4 }, 1, decodePng)).toThrow("No capture to crop — start a new snip.");
  });

  it("a crop that cannot be encoded is Encode with its cause", () => {
    const state = new CaptureState();
    state.frame = { png: TestImage.blank(8, 8).toPNG(), monitor: mon(0, 0, 8, 8) };
    const decode = () => ({
      getSize: () => ({ width: 8, height: 8 }),
      crop: () => {
        throw new Error("bad rect");
      },
      toPNG: () => new Uint8Array(0),
    });
    expect(() => cropFromState(state, { x: 0, y: 0, w: 4, h: 4 }, 1, decode)).toThrow(
      "Could not encode the cropped image as PNG — try again; if it repeats, restart Collide. (bad rect)",
    );
  });
});
