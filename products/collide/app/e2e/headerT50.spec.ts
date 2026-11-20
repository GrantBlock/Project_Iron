// T50 acceptance (Grant 2026-11-20), written before the code (Lydia, tests first): the header's Save, Save source,
// Save as and Copy show only their icon when the HEADER is too narrow for their words (measured width, so open side
// panels count), and keep their tooltip and accessible name; Close keeps its word; nothing in the header overlaps or
// clips. This replaces T45's "820 px or less window width" rule (the old @media rule in shell.css).
//
// ASSUMED HOOK (the Coder must provide it): the header element `.wshead` carries `data-compact="true"` when it shows
// icons only and `data-compact="false"` otherwise (always present on a Snip / Markdown / PDF tab's header). The
// switch is by the header's own measured width (ResizeObserver or a container query), not by window width.
// Icon-only buttons keep their words as an aria-label (Save, Save source, Save as, Copy to clipboard) and their title.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MIN_HEIGHT, MIN_WIDTH } from "../src/native/minSize";

const SNIP = "/tests/fixtures/sample-400x300.png";
const ws = (page: Page) => page.getByRole("region", { name: "Workspace" });
const head = (page: Page) => ws(page).locator(".wshead");

async function openSnip(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), SNIP);
  await ws(page).getByRole("toolbar", { name: "Markup tools" }).waitFor();
  // A callout, so the callout panel has a row (the panel is open beside the picture).
  await ws(page).getByRole("toolbar", { name: "Markup tools" }).getByRole("button", { name: "Add border" }).click();
  await expect(page.getByRole("complementary", { name: "Callouts" })).toBeVisible();
}
async function openMarkdown(page: Page) {
  await page.goto("/?sample");
  await page.getByRole("complementary", { name: "Recents" }).getByRole("button", { name: "P06-Project-Workspace-Spec.md", exact: true }).click();
  await ws(page).getByRole("toolbar", { name: "Markdown tools" }).waitFor();
}

/** The four buttons: how to find each, its accessible name, and what its tooltip must mention. */
const BUTTONS = [
  { word: "Save", name: "Save", exact: true, tip: /Save/ },
  { word: "Save source", name: "Save source", exact: true, tip: /\.collide/ },
  { word: "Save as", name: "Save as", exact: true, tip: /picture|PDF|text/i },
  { word: "Copy", name: "Copy to clipboard", exact: true, tip: /Copy to clipboard/ },
] as const;

/** True when the button shows its words: some text-carrying element in it has a real, visible width. */
const showsWords = (b: Locator) =>
  b.evaluate((el) => {
    for (const n of el.querySelectorAll("*")) {
      if (n.children.length > 0 || !(n.textContent ?? "").trim()) continue;
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      if (cs.display !== "none" && cs.visibility !== "hidden" && r.width > 4 && r.height > 4) return true;
    }
    return false;
  });

interface Box { x: number; y: number; w: number; h: number; what: string }
/** The header's own width, its compact flag, and the boxes of everything in it that takes room. */
const headerState = (page: Page) =>
  head(page).evaluate((el) => {
    const h = el.getBoundingClientRect();
    const boxes: Box[] = [];
    const add = (n: Element, what: string) => {
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      if (cs.display === "none" || cs.visibility === "hidden" || r.width === 0 || r.height === 0) return;
      boxes.push({ x: r.x, y: r.y, w: r.width, h: r.height, what });
    };
    for (const c of el.children) {
      if (c.classList.contains("grow")) continue;
      if (c.classList.contains("saveas")) {
        for (const b of c.querySelectorAll(":scope > button")) add(b, `saveas button "${b.getAttribute("aria-label") ?? b.textContent}"`);
      } else add(c, `${c.tagName.toLowerCase()}.${c.className}`);
    }
    // A button clips its own words when its content is wider than the button.
    const clipped = [...el.querySelectorAll("button")].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
    return { width: h.width, left: h.x, right: h.x + h.width, top: h.y, bottom: h.y + h.height, compact: el.getAttribute("data-compact"), boxes, clipped, headScroll: el.scrollWidth > el.clientWidth + 1 };
  });

async function expectHeaderClean(page: Page) {
  const s = await headerState(page);
  for (const b of s.boxes) {
    expect(b.x, `${b.what} inside on the left`).toBeGreaterThanOrEqual(s.left - 0.5);
    expect(b.x + b.w, `${b.what} inside on the right`).toBeLessThanOrEqual(s.right + 0.5);
    expect(b.y, `${b.what} inside on top`).toBeGreaterThanOrEqual(s.top - 0.5);
    expect(b.y + b.h, `${b.what} inside at the bottom`).toBeLessThanOrEqual(s.bottom + 0.5);
  }
  for (let i = 0; i < s.boxes.length; i++) {
    for (let j = i + 1; j < s.boxes.length; j++) {
      const a = s.boxes[i];
      const b = s.boxes[j];
      const overlap = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
      expect(overlap, `${a.what} and ${b.what} must not overlap`).toBe(false);
    }
  }
  expect(s.clipped, "no button clips its own content").toEqual([]);
  expect(s.headScroll, "the header does not scroll across").toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  return s;
}

/** Name, tooltip and (by the compact flag) words or icon only, for the four buttons and Close. */
async function expectButtons(page: Page, compact: boolean) {
  const h = head(page);
  for (const b of BUTTONS) {
    const btn = h.getByRole("button", { name: b.name, exact: b.exact });
    await expect(btn, `${b.name} is there`).toBeVisible();
    expect((await btn.getAttribute("title")) ?? "", `${b.name} keeps its tooltip`).toMatch(b.tip);
    expect(await showsWords(btn), `${b.name}: words ${compact ? "hidden" : "shown"}`).toBe(!compact);
    await expect(btn.locator("svg").first(), `${b.name} keeps its icon`).toBeVisible();
  }
  const close = h.getByRole("button", { name: "Close", exact: false }).last();
  await expect(close).toBeVisible();
  expect(await showsWords(close), "Close keeps its word").toBe(true);
}

/** Every width from the minimum up to wide, with side panels open (the callout panel on a Snip, the sections on Markdown). */
const WIDTHS = [MIN_WIDTH, MIN_WIDTH + 60, MIN_WIDTH + 120, MIN_WIDTH + 200, MIN_WIDTH + 300, MIN_WIDTH + 450, 1800].filter((w, i, a) => a.indexOf(w) === i);

for (const [kind, open] of [["snip", openSnip], ["markdown", openMarkdown]] as const) {
  test(`${kind}: the icon-only switch follows the header's measured width, words never clip or overlap`, async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: Math.max(MIN_HEIGHT, 900) });
    await open(page);
    const samples: { viewport: number; width: number; compact: boolean }[] = [];
    for (const vw of [...WIDTHS].reverse()) {
      await page.setViewportSize({ width: vw, height: Math.max(MIN_HEIGHT, 900) });
      await expect(head(page)).toHaveAttribute("data-compact", /^(true|false)$/);
      // Let the measured switch settle after the resize.
      await expect.poll(async () => (await headerState(page)).width).toBeGreaterThan(0);
      await page.waitForTimeout(150);
      const s = await expectHeaderClean(page);
      const compact = s.compact === "true";
      await expectButtons(page, compact);
      samples.push({ viewport: vw, width: s.width, compact });
    }
    // Wide: words. (1800 px with a side panel open leaves the header far wider than its words need.)
    expect(samples[0].compact, "wide window: words").toBe(false);
    // One threshold on the header's own width: every icon-only header is narrower than every header with words.
    const narrowestWords = Math.min(...samples.filter((s) => !s.compact).map((s) => s.width));
    const widestIcons = Math.max(-Infinity, ...samples.filter((s) => s.compact).map((s) => s.width));
    expect(widestIcons, `icon-only headers (${JSON.stringify(samples)}) are narrower than headers with words`).toBeLessThan(narrowestWords);
  });
}

test("the switch is by the header's width, not the window's: the old 820 px rule is gone", async ({ page }) => {
  // At a wide window the header has words even though the viewport rule would not apply; at the minimum window the
  // header can be compact while the viewport is far above 820 px. Neither depends on `max-width: 820px` any more.
  await page.setViewportSize({ width: 1800, height: 900 });
  await openSnip(page);
  await expect(head(page)).toHaveAttribute("data-compact", "false");
  const css = await page.evaluate(() => {
    const rules: string[] = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const r of sheet.cssRules) if (r instanceof CSSMediaRule && /max-width:\s*820px/.test(r.conditionText)) for (const c of r.cssRules) rules.push(c.cssText);
      } catch { /* cross-origin sheet */ }
    }
    return rules.filter((t) => /\.wshead[^{]*\.btn\s*>\s*span|\.saveas[^{]*\.btn\s*>\s*span/.test(t));
  });
  expect(css, "no @media (max-width: 820px) rule hides the header buttons' words").toEqual([]);
});

test("Close keeps its word and the buttons keep tooltips when icon-only, on a PDF tab too", async ({ page }) => {
  await page.setViewportSize({ width: MIN_WIDTH, height: Math.max(MIN_HEIGHT, 800) });
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles("tests/fixtures/two-pages.pdf");
  await expect(page.locator('[data-testid="pdf-page"][data-drawn="yes"]')).toBeVisible();
  await expect(head(page)).toHaveAttribute("data-compact", /^(true|false)$/);
  await page.waitForTimeout(150);
  const s = await expectHeaderClean(page);
  await expectButtons(page, s.compact === "true");
});
