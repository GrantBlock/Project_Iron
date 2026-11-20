// The two things every reference spec runs against (RUN3 "The reference").
export type Target = "prototype" | "app";

export interface RefOptions {
  /** Which one this Playwright project drives. */
  target: Target;
  /** Where it is: the prototype's file:// address, or the app's http address. */
  targetUrl: string;
}

/** The app as built by `vite build`, served by `vite preview`. */
export const APP_PORT = 4173;

/** Screenshot sizes and themes (RUN3: 1440 × 860 and 400 × 800; Dark, Light and Aura with the Sage ground). */
export const SIZES = [
  { width: 1440, height: 860 },
  { width: 400, height: 800 },
] as const;
export const THEMES = [
  { id: "dark", aura: null },
  { id: "light", aura: null },
  { id: "aura", aura: "sage" },
] as const;

/** Everything the harness writes (gitignored), relative to the app folder. */
export const OUT_DIR = "reference-out";
