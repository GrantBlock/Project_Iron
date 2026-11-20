// @vitest-environment node
// T50 review round 1: on a small or high-scaling screen the window and its minimum stay inside the work area
// (1366 x 768 at 125% is a 1093 x 730 work area or so; 1920 x 1080 at 150% is 1280 x 690 or so).
import { describe, expect, it } from "vitest";
import { MIN_HEIGHT, MIN_WIDTH, fitBounds, fitMinimum, fitWindow } from "./minSize";

const frame = { width: 16, height: 39 };
describe("fitMinimum", () => {
  it("is MIN + frame on a big screen", () => {
    expect(fitMinimum(frame, { x: 0, y: 0, width: 1920, height: 1040 })).toEqual([MIN_WIDTH + 16, MIN_HEIGHT + 39]);
  });
  it("is at most the work area per side", () => {
    expect(fitMinimum(frame, { x: 0, y: 0, width: 1093, height: 700 })).toEqual([1093, MIN_HEIGHT + 39]);
    expect(fitMinimum(frame, { x: 0, y: 0, width: 1280, height: 420 })).toEqual([MIN_WIDTH + 16, 420]);
  });
});

describe("fitBounds", () => {
  const area = { x: 1920, y: 0, width: 1093, height: 690 };
  it("null when the window fits", () => {
    expect(fitBounds({ x: 1950, y: 10, width: 800, height: 600 }, area)).toBeNull();
  });
  it("shrinks and moves a window that does not fit into the work area", () => {
    expect(fitBounds({ x: 1900, y: 50, width: 1296, height: 839 }, area)).toEqual({ x: 1920, y: 0, width: 1093, height: 690 });
    expect(fitBounds({ x: 2800, y: 100, width: 600, height: 400 }, area)).toEqual({ x: 1920 + 1093 - 600, y: 100, width: 600, height: 400 });
  });
});

describe("fitWindow", () => {
  const fake = (b: { x: number; y: number; width: number; height: number }) => {
    const log: string[] = [];
    const s = { b };
    return {
      log,
      s,
      w: {
        getBounds: () => s.b,
        getContentBounds: () => ({ ...s.b, width: s.b.width - frame.width, height: s.b.height - frame.height }),
        setBounds: (n: typeof b) => {
          log.push(`setBounds ${n.x},${n.y} ${n.width}x${n.height}`);
          s.b = n;
        },
        setMinimumSize: (w: number, h: number) => log.push(`min ${w}x${h}`),
      },
    };
  };
  it("a big screen: minimum MIN + frame, bounds untouched", () => {
    const f = fake({ x: 100, y: 100, width: 1296, height: 839 });
    fitWindow(f.w, { x: 0, y: 0, width: 1920, height: 1040 });
    expect(f.log).toEqual([`min ${MIN_WIDTH + 16}x${MIN_HEIGHT + 39}`]);
  });
  it("1366 x 768 at 125%: the minimum is lowered first, then the window fits the work area", () => {
    const f = fake({ x: 100, y: 0, width: 1296, height: 839 });
    fitWindow(f.w, { x: 0, y: 0, width: 1093, height: 584 });
    expect(f.log).toEqual([`min 1093x${MIN_HEIGHT + 39}`, "setBounds 0,0 1093x584"]);
  });
});
