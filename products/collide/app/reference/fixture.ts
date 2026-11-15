import { test as base, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RefState } from "../src/editor/refState";
import { OUT_DIR, SIZES, THEMES, type RefOptions, type Target } from "./targets";

// The shared fixture of the reference specs (RUN3 T30).
//
// A spec is written once and runs against the prototype and against the app. It may use only:
//   - the visible UI: roles, labels and text (page.getByRole, getByLabel, getByText);
//   - `state()`: window.__collide.state(), the same read-only test hook in both (../../prototype-checks/HOOK.md).
// Never `window.S`, `snipOf()`, CSS classes, ids, data- attributes, test ids, screen positions of
// things that have a role, or the app's other hooks. What differs between the two targets belongs
// in this file, not in a spec.

/** The one call a reference spec may make into the page. */
type Hooked = { __collide?: { state?: () => RefState } };

export type { RefState };
export type RefItem = RefState["items"][number];

interface Fixtures {
  /** Load the target fresh (nothing saved from an earlier test) and wait until it is ready. */
  open: () => Promise<void>;
  /** Reload the page, keeping what the target saved, and wait until it is ready ("remembered after a reload"). */
  reload: () => Promise<void>;
  /** window.__collide.state(): a fresh copy each call. */
  state: () => Promise<RefState>;
  /**
   * Screenshots of the page as it is now: 1440 × 860 and 400 × 800 in Dark, Light and Aura (Sage),
   * saved under reference-out/screens/<project>/<spec>/<name>-<theme>-<size>.png.
   * Afterwards the window size and the theme are as before. Never fails a spec: when the theme cannot be
   * set (the app has no themes yet, or a splash covers its Appearance button) it takes the two sizes in the
   * current theme and says so in the test's annotations. Changing the theme redraws the window, so call it
   * at a steady point: not mid-drag, and not while a field that must keep the cursor has it.
   */
  shots: (name: string) => Promise<void>;
  /** Uncaught page errors so far. Checked after every test: a spec fails if there are any. */
  pageErrors: string[];
}

const appDir = fileURLToPath(new URL("..", import.meta.url));
const ready = (page: Page) => page.waitForFunction(() => typeof (window as unknown as Hooked).__collide?.state === "function");
/** The layout settles after a resize (the prototype waits 120 ms, then fits the view and redraws). */
const SETTLE_MS = 300;

// The prototype's own names, used in one place only: setTheme below.
declare const S: { theme: string; aura: string };
declare function applyTheme(): void;
declare function render(): void;

/**
 * Set the theme for a screenshot. False when it cannot be done.
 * App: the way a user does it: Appearance, then the theme, then the Aura ground.
 * Prototype: the one place the harness reaches into it. Picking a theme in its Appearance popover while a
 * snip is open redraws the canvas without the tab bar (ISSUES 17), and a splash covers the popover, so the
 * harness sets the theme and redraws the whole window instead. Specs never do this.
 */
async function setTheme(page: Page, target: Target, id: string, aura: string | null): Promise<boolean> {
  if (target === "prototype") {
    await page.evaluate(
      ([theme, ground]) => {
        S.theme = theme as string;
        if (ground) S.aura = ground;
        applyTheme();
        render();
      },
      [id, aura],
    );
    return true;
  }
  const timeout = 1500;
  const button = page.getByRole("button", { name: "Appearance", exact: true });
  const dialog = page.getByRole("dialog", { name: "Appearance" });
  try {
    if (!(await dialog.isVisible())) await button.click({ timeout });
    await dialog.getByRole("button", { name: id[0].toUpperCase() + id.slice(1), exact: true }).click({ timeout });
    if (aura) await dialog.getByRole("button", { name: aura, exact: true }).click({ timeout });
    await button.click({ timeout });
    await expect(dialog).toBeHidden({ timeout });
    return true;
  } catch {
    return false;
  }
}

export const test = base.extend<Fixtures & RefOptions>({
  target: ["prototype", { option: true }],
  targetUrl: ["", { option: true }],

  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await use(errors);
      expect(errors, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],

  open: async ({ page, targetUrl }, use) => {
    await use(async () => {
      // Every test has its own browser context, so nothing is saved from an earlier test.
      // T31 onward: when the app needs the prototype's sample Recents to start from, load them here.
      await page.goto(targetUrl);
      await ready(page);
    });
  },

  reload: async ({ page }, use) => {
    await use(async () => {
      await page.reload();
      await ready(page);
    });
  },

  state: async ({ page }, use) => {
    await use(() => page.evaluate(() => (window as unknown as Hooked).__collide!.state!()));
  },

  shots: async ({ page, state, target }, use, testInfo) => {
    await use(async (name) => {
      if (process.env.REF_SHOTS === "0") return;
      const dir = join(appDir, OUT_DIR, "screens", testInfo.project.name, basename(testInfo.file).replace(/\.spec\.ts$/, ""));
      mkdirSync(dir, { recursive: true });
      const before = await state();
      const size = page.viewportSize() ?? SIZES[0];
      const snap = async (theme: string) => {
        for (const s of SIZES) {
          await page.setViewportSize(s);
          await page.waitForTimeout(SETTLE_MS);
          await page.screenshot({ path: join(dir, `${name}-${theme}-${s.width}x${s.height}.png`) });
        }
        await page.setViewportSize(SIZES[0]);
        await page.waitForTimeout(SETTLE_MS);
      };
      let themed = 0;
      for (const t of THEMES) {
        if (!(await setTheme(page, target, t.id, t.aura))) break;
        await snap(t.aura ? `${t.id}-${t.aura}` : t.id);
        themed++;
      }
      if (themed === 0) {
        testInfo.annotations.push({ type: "screens", description: `${name}: theme control not reachable; current theme only` });
        await snap("current");
      } else if (before.theme) {
        // Put the theme back the way it was.
        await setTheme(page, target, before.theme, before.aura);
      }
      await page.setViewportSize(size);
      await page.waitForTimeout(SETTLE_MS);
    });
  },
});

export { expect };
