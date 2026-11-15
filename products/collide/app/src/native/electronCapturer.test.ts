// T14: the real capturer's display maths, with fake `screen` and `desktopCapturer`.
import { describe, expect, it } from "vitest";
import { CaptureError, CaptureState, cropFromState } from "./capture";
import { captureMonitor, electronCapturer, physicalSize, sourceForDisplay, type DisplayLike, type ScreenLike, type ScreenSourceLike } from "./electronCapturer";
import { decodeDataUrl, decodePng, TestImage } from "./testImage";

function display(id: number, x: number, y: number, width: number, height: number, scaleFactor: number): DisplayLike {
  return { id, bounds: { x, y, width, height }, size: { width, height }, scaleFactor };
}

/** A thumbnail of exactly the requested size, as desktopCapturer gives for a display's own aspect ratio. */
function thumb(width: number, height: number, empty = false) {
  const image = TestImage.marked(width, height);
  return Object.assign(image, { isEmpty: () => empty });
}

interface Setup {
  displays: DisplayLike[];
  cursor: { x: number; y: number };
  /** Windows-style DIP -> physical conversion, if the platform has one. */
  dipToScreenPoint?: ScreenLike["dipToScreenPoint"];
  sources?: (size: { width: number; height: number }) => ScreenSourceLike[];
}

function setup(s: Setup) {
  const requests: { types: string[]; thumbnailSize: { width: number; height: number } }[] = [];
  const inside = (d: DisplayLike, p: { x: number; y: number }) =>
    p.x >= d.bounds.x && p.x < d.bounds.x + d.bounds.width && p.y >= d.bounds.y && p.y < d.bounds.y + d.bounds.height;
  const screen: ScreenLike = {
    getCursorScreenPoint: () => s.cursor,
    getDisplayNearestPoint: (p) => s.displays.find((d) => inside(d, p)) ?? s.displays[0],
    dipToScreenPoint: s.dipToScreenPoint,
  };
  const desktopCapturer = {
    getSources: async (options: { types: string[]; thumbnailSize: { width: number; height: number } }) => {
      requests.push(options);
      if (s.sources) return s.sources(options.thumbnailSize);
      // Every display answers at the requested size; only the matching one is used.
      return s.displays.map((d) => ({ display_id: String(d.id), thumbnail: thumb(options.thumbnailSize.width, options.thumbnailSize.height) }));
    },
  };
  return { deps: { screen, desktopCapturer }, requests };
}

async function captureError(p: Promise<unknown>): Promise<CaptureError> {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(CaptureError);
  return err as CaptureError;
}

describe("physicalSize", () => {
  it.each([
    [1, 1920, 1080],
    [1.25, 1536, 864],
    [1.5, 1280, 720],
    [2, 960, 540],
  ])("at %f a 1920x1080 panel is captured at full physical size", (scale, dipW, dipH) => {
    expect(physicalSize(display(1, 0, 0, dipW, dipH, scale))).toEqual({ width: 1920, height: 1080 });
  });

  it("rounds to whole pixels when the DIP size is fractional at the scale", () => {
    // 1366x768 at 125% reports 1093x614 DIP.
    expect(physicalSize(display(1, 0, 0, 1093, 614, 1.25))).toEqual({ width: 1366, height: 768 });
  });
});

describe("sourceForDisplay", () => {
  const d = display(42, 0, 0, 100, 100, 1);
  it("matches by display id", () => {
    const sources = [{ display_id: "7" }, { display_id: "42" }];
    expect(sourceForDisplay(sources, d)).toBe(sources[1]);
  });
  it("takes a lone source when the platform gives no usable id", () => {
    const sources = [{ display_id: "" }];
    expect(sourceForDisplay(sources, d)).toBe(sources[0]);
  });
  it("refuses to guess between several sources without a match", () => {
    expect(sourceForDisplay([{ display_id: "" }, { display_id: "" }], d)).toBeUndefined();
    expect(sourceForDisplay([], d)).toBeUndefined();
  });
});

describe("electronCapturer", () => {
  it.each([
    [1, 192, 108],
    [1.25, 153.6, 86.4],
    [1.5, 128, 72],
    [2, 96, 54],
  ])("at %f asks for the display's physical size and reports the frame's size and the scale", async (scale, dipW, dipH) => {
    const { deps, requests } = setup({ displays: [display(1, 0, 0, dipW, dipH, scale)], cursor: { x: 5, y: 5 } });
    const state = new CaptureState();
    const r = await captureMonitor(deps, state);
    expect(requests).toEqual([{ types: ["screen"], thumbnailSize: { width: 192, height: 108 } }]);
    expect([r.width, r.height, r.x, r.y, r.scaleFactor]).toEqual([192, 108, 0, 0, scale]);
    expect(decodeDataUrl(r.png).getSize()).toEqual({ width: 192, height: 108 });
    expect(decodePng(state.frame!.png).getSize()).toEqual({ width: 192, height: 108 });
  });

  it("captures the display under the cursor, not the primary", async () => {
    const primary = display(1, 0, 0, 100, 80, 1);
    const left = display(2, -160, 0, 160, 90, 1.5); // left of the primary: negative origin
    const { deps, requests } = setup({ displays: [primary, left], cursor: { x: -20, y: 40 } });
    const state = new CaptureState();
    const r = await captureMonitor(deps, state);
    expect(requests[0].thumbnailSize).toEqual({ width: 240, height: 135 });
    expect([r.width, r.height, r.scaleFactor]).toEqual([240, 135, 1.5]);
    expect(state.frame!.display).toEqual({ id: 2, bounds: { x: -160, y: 0, width: 160, height: 90 } });
  });

  it("reports a negative monitor origin in physical px (Windows conversion when there is one)", async () => {
    const above = display(3, -200, -150, 200, 150, 1.25);
    const windows = setup({ displays: [above], cursor: { x: -10, y: -10 }, dipToScreenPoint: (p) => ({ x: p.x * 1.25, y: p.y * 1.25 + 0.4 }) });
    const r = await captureMonitor(windows.deps, new CaptureState());
    expect([r.x, r.y]).toEqual([-250, -187]);
    const noConversion = setup({ displays: [above], cursor: { x: -10, y: -10 } });
    const r2 = await captureMonitor(noConversion.deps, new CaptureState());
    expect([r2.x, r2.y]).toEqual([-250, -187]); // -187.5 rounds to -187
  });

  it("capture then crop on a negative-origin 150% display takes pixels from the right region", async () => {
    const left = display(2, -160, -40, 160, 90, 1.5);
    const { deps } = setup({ displays: [display(1, 0, 0, 100, 80, 1), left], cursor: { x: -1, y: -1 } });
    const state = new CaptureState();
    await captureMonitor(deps, state);
    const r = cropFromState(state, { x: 10, y: 8, w: 20, h: 10 }, 1.5, decodePng);
    expect([r.width, r.height]).toEqual([30, 15]);
    expect(decodeDataUrl(r.png).pixel(0, 0)).toEqual([15, 12, 7, 255]);
  });

  it("uses the frame's own size if the platform returns a different one than asked", async () => {
    const { deps } = setup({
      displays: [display(1, 0, 0, 100, 80, 2)],
      cursor: { x: 0, y: 0 },
      sources: () => [{ display_id: "1", thumbnail: thumb(199, 160) }],
    });
    const r = await captureMonitor(deps, new CaptureState());
    expect([r.width, r.height]).toEqual([199, 160]);
  });

  it("no cursor position is CursorUnavailable", async () => {
    const { deps } = setup({ displays: [display(1, 0, 0, 100, 80, 1)], cursor: { x: NaN, y: 0 } });
    const state = new CaptureState();
    expect((await captureError(captureMonitor(deps, state))).kind).toBe("CursorUnavailable");
    deps.screen.getCursorScreenPoint = () => {
      throw new Error("no pointer");
    };
    const err = await captureError(captureMonitor(deps, state));
    expect(err.message).toBe("Could not read the cursor position — move the mouse and try again.");
    expect(state.frame).toBeNull();
  });

  it("no display or no matching screen source is NoMonitor", async () => {
    const one = setup({ displays: [display(1, 0, 0, 100, 80, 1)], cursor: { x: 0, y: 0 }, sources: () => [] });
    expect((await captureError(captureMonitor(one.deps, new CaptureState()))).kind).toBe("NoMonitor");
    const bad = setup({ displays: [display(1, 0, 0, 0, 0, 1)], cursor: { x: 0, y: 0 } });
    expect((await captureError(captureMonitor(bad.deps, new CaptureState()))).kind).toBe("NoMonitor");
    const thrower = setup({ displays: [display(1, 0, 0, 100, 80, 1)], cursor: { x: 0, y: 0 } });
    thrower.deps.screen.getDisplayNearestPoint = () => {
      throw new Error("gone");
    };
    const err = await captureError(electronCapturer(thrower.deps).captureAt(0, 0));
    expect(err.message).toBe("No monitor found under the cursor — check your display setup and try again.");
  });

  it("a rejected or empty capture is CaptureFailed with the permission fix, state unchanged", async () => {
    const state = new CaptureState();
    const held = { png: TestImage.blank(4, 4).toPNG(), monitor: { x: 0, y: 0, width: 4, height: 4, scaleFactor: 1 } };
    state.frame = held;
    const denied = setup({
      displays: [display(1, 0, 0, 100, 80, 1)],
      cursor: { x: 0, y: 0 },
      sources: () => {
        throw new Error("denied");
      },
    });
    const err = await captureError(captureMonitor(denied.deps, state));
    expect(err.kind).toBe("CaptureFailed");
    expect(err.message).toBe("Screen capture failed — check screen recording permission and try again. (denied)");
    const blank = setup({
      displays: [display(1, 0, 0, 100, 80, 1)],
      cursor: { x: 0, y: 0 },
      sources: () => [{ display_id: "1", thumbnail: thumb(100, 80, true) }],
    });
    expect((await captureError(captureMonitor(blank.deps, state))).kind).toBe("CaptureFailed");
    expect(state.frame).toBe(held);
  });
});
