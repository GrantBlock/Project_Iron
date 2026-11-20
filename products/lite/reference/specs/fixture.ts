import { test as base, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Target-agnostic fixture. The page under test comes from
 *   LITE_TARGET_URL   (default: the prototype's file:// URL)
 *   LITE_TARGET_NAME  (default "prototype"; names the screenshot folder)
 *   LITE_SHOTS_DIR    (default reference/shots/<target>/)
 */
const here = path.resolve(__dirname, "..");
export const PROTOTYPE_URL = pathToFileURL(
  path.resolve(here, "../prototype/exports/P16-lite/index.html"),
).href;
export const TARGET_URL = process.env.LITE_TARGET_URL || PROTOTYPE_URL;
export const TARGET_NAME = process.env.LITE_TARGET_NAME || "prototype";
export const SHOTS_DIR =
  process.env.LITE_SHOTS_DIR || path.join(here, "shots", TARGET_NAME);

export const DESKTOP = { width: 1440, height: 860 };
export const PHONE = { width: 400, height: 800 };

export type Msg = { role: "user" | "assistant"; text: string; citations: number };
export type LiteState = {
  selected: { id: string | null; type: "about" | "document" | "model" | "note"; title: string; path: string };
  openFolders: string[];
  view: { type: "about" | "document" | "model" | "note"; page: number | null; pageCount: number | null };
  search: { query: string; matchCount: number; highlights: number };
  assistantShown: boolean;
  tab: "files" | "view" | "assistant" | null;
  messages: Msg[];
};

export const test = base.extend<{ lite: Page }>({
  lite: async ({ page }, use) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(TARGET_URL);
    await page.waitForFunction(() => !!(window as any).__lite);
    await use(page);
  },
});
export { expect };

export const state = (page: Page): Promise<LiteState> =>
  page.evaluate(() => (window as any).__lite.state());

/** Save screenshots of the current UI at 1440x860 and 400x800, then restore the size. */
export async function shots(page: Page, name: string) {
  const dir = SHOTS_DIR;
  mkdirSync(dir, { recursive: true });
  const before = page.viewportSize() ?? DESKTOP;
  for (const [tag, size] of [["1440x860", DESKTOP], ["400x800", PHONE]] as const) {
    await page.setViewportSize(size);
    await page.screenshot({ path: path.join(dir, `${name}-${tag}.png`) });
  }
  await page.setViewportSize(before);
}

export const tree = (page: Page) => page.getByLabel("Package files");
export const viewer = (page: Page) => page.getByRole("main", { name: "Viewer" });
export const assistant = (page: Page) => page.getByRole("complementary", { name: "Assistant" });

/** Marks a test whose assertion is a Grant decision that overrides the prototype (README, "Grant overrides"). */
export const grantOverride = (issue: string) => ({
  annotation: { type: "grant-override", description: `Grant 2026-11-17: ${issue} — overrides the prototype` },
});
