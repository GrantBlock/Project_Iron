// T42 (1.1): the starting crosshair has more contrast, so the start point is easy to see on light and dark screens.
// The look on a real Windows screen is manual (TESTER-NOTES Run 4 item 1); here: its colours and contrast ratios.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CROSSHAIR, contrastRatio, mix, type Rgb } from "./crosshair";

const colorsCss = readFileSync(resolve(__dirname, "../../../design-system/tokens/colors.css"), "utf8");

/** A design-system colour token (#RRGGBB) as [r, g, b]. */
function token(ref: string): Rgb {
  const name = /^var\((--[\w-]+)\)$/.exec(ref)?.[1];
  expect(name, `${ref} is a design-system token`).toBeTruthy();
  const hex = new RegExp(`${name}:\\s*#([0-9a-fA-F]{6})\\b`).exec(colorsCss)?.[1];
  expect(hex, `${name} is a #RRGGBB colour in colors.css`).toBeTruthy();
  return [0, 2, 4].map((i) => parseInt(hex!.slice(i, i + 2), 16)) as unknown as Rgb;
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
// Before a drag the whole frame is dimmed ~50% toward --ink-975 (Overlay.tsx, overlay-dim).
const dimmed = (frame: Rgb) => mix(frame, token("var(--ink-975)"), 0.5);

describe("contrastRatio (WCAG 2)", () => {
  it("is 21 for black on white, 1 for a colour on itself, and symmetric", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrastRatio([120, 30, 200], [120, 30, 200])).toBeCloseTo(1, 5);
    expect(contrastRatio([10, 200, 90], WHITE)).toBeCloseTo(contrastRatio(WHITE, [10, 200, 90]), 5);
  });
});

describe("T42 starting crosshair colours", () => {
  it("uses design-system tokens only: a light core with a dark outline", () => {
    const core = token(CROSSHAIR.core);
    const outline = token(CROSSHAIR.outline);
    expect(contrastRatio(core, BLACK)).toBeGreaterThan(contrastRatio(core, WHITE)); // the core is the light one
    expect(contrastRatio(core, outline)).toBeGreaterThanOrEqual(7); // the two read apart from each other
  });

  it.each([
    ["white frame", WHITE],
    ["black frame", BLACK],
    ["white frame, dimmed as shown", dimmed(WHITE)],
    ["black frame, dimmed as shown", dimmed(BLACK)],
  ] as const)("on a %s one of its two edges stands out at least 4.5:1", (_n, frame) => {
    const best = Math.max(contrastRatio(token(CROSSHAIR.core), frame), contrastRatio(token(CROSSHAIR.outline), frame));
    expect(best).toBeGreaterThanOrEqual(4.5);
  });

  it("is thicker than the 1 px system cursor: a core of at least 2 px inside an outline of at least 1 px", () => {
    expect(CROSSHAIR.coreWidth).toBeGreaterThanOrEqual(2);
    expect(CROSSHAIR.outlineWidth).toBeGreaterThanOrEqual(1);
    expect(CROSSHAIR.arm).toBeGreaterThanOrEqual(10);
  });
});
