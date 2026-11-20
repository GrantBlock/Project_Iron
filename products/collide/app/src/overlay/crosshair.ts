// T42 (1.1): the starting crosshair of the snip overlay. The system crosshair is a thin 1 px line that is hard to see
// on a busy, light or dark screen, so the overlay draws its own before the press: a light core with a dark outline,
// which stands out on both. Design-system tokens only. The drag box is unchanged.

export type Rgb = readonly [number, number, number];

export const CROSSHAIR = {
  /** The light core of each bar. */
  core: "var(--ink-50)",
  /** The dark outline around the core. */
  outline: "var(--ink-975)",
  /** Core thickness, px. */
  coreWidth: 2,
  /** Outline thickness around the core, px. */
  outlineWidth: 1,
  /** Length of each arm from the centre, px. */
  arm: 12,
} as const;

/** a mixed toward b by t (0 = a, 1 = b), as CSS color-mix in sRGB. */
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i] * (1 - t) + b[i] * t) as unknown as Rgb;

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG 2 contrast ratio of two sRGB colours, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
