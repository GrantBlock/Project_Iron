import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// T52: Paper is the Aura paper ground (replaces the old Collide Light), in a real browser with the CSS applied.
// The expected colours are read from aura.css, so a change of the paper tokens there moves this test with it.
// Screenshots of the five looks go to ../reports/T52/.

test.use({ colorScheme: "dark", viewport: { width: 1280, height: 800 } });

const IMAGE_FILE = fileURLToPath(new URL("../tests/fixtures/sample-400x300.png", import.meta.url));
const SHOTS = fileURLToPath(new URL("../../reports/T52/", import.meta.url));
const AURA_CSS = readFileSync(fileURLToPath(new URL("../src/shell/aura.css", import.meta.url)), "utf8");

type Rgba = [number, number, number, number];
const paperToken = (name: string): string => {
  const line = AURA_CSS.split("\n").find((l) => l.startsWith('[data-aura-theme="paper"]'));
  const m = line?.match(new RegExp(`--aura-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`paper --aura-${name} not found in aura.css`);
  return m[1].toLowerCase();
};
const hexRgb = (h: string): Rgba => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const lum = ([r, g, b]: Rgba) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const near = (a: Rgba, b: Rgba, tol = 3) => [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) <= tol);

/** Any CSS colour (rgb, color(srgb), color-mix result...) as RGBA, normalised through a canvas. */
async function rgba(page: Page, css: string): Promise<Rgba> {
  return page.evaluate((c) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const x = cv.getContext("2d")!;
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = c;
    x.fillRect(0, 0, 1, 1);
    return Array.from(x.getImageData(0, 0, 1, 1).data) as Rgba;
  }, css);
}
/** The colour a selector shows behind it: the first ancestor (or itself) with a non-transparent background. */
async function groundOf(page: Page, selector: string): Promise<Rgba> {
  const css = await page.evaluate((s) => {
    let el: Element | null = document.querySelector(s);
    while (el) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg && !/rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(bg)) return bg;
      el = el.parentElement;
    }
    return "rgb(0, 0, 0)";
  }, selector);
  return rgba(page, css);
}
const colorOf = async (page: Page, locator: ReturnType<Page["locator"]>) => rgba(page, await locator.evaluate((e) => getComputedStyle(e).color));

/** The body colour fades in 240 ms (the prototype's): wait until the ground has settled on the expected colour. */
const settled = (page: Page, selector: string, want: Rgba) => expect.poll(async () => near(await groundOf(page, selector), want, 1)).toBe(true);

async function openPaper(page: Page) {
  await page.goto("/?sample");
  await page.getByRole("button", { name: "Appearance" }).click();
  const pop = page.getByRole("dialog", { name: "Appearance" });
  await pop.getByRole("button", { name: "Paper" }).click();
  return pop;
}

test("Paper puts the Aura paper ground on the whole app, with the paper amber accent", async ({ page }) => {
  await openPaper(page);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-app-theme", "aura");
  await expect(html).toHaveAttribute("data-aura-theme", "paper");
  const ground = hexRgb(paperToken("bg"));
  await settled(page, '[data-testid="app-root"]', ground);
  await settled(page, "body", ground);
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(near(await rgba(page, accent), hexRgb(paperToken("accent")), 1)).toBe(true);
  expect(paperToken("accent")).toBe("#fcbc5c");
});

test("the Paper swatch is drawn from the same ground and is pressed", async ({ page }) => {
  const pop = await openPaper(page);
  const sw = pop.getByRole("button", { name: "Paper" });
  await expect(sw).toHaveAttribute("aria-pressed", "true");
  const bg = await rgba(page, await sw.evaluate((e) => getComputedStyle(e).backgroundColor));
  expect(near(bg, hexRgb(paperToken("bg")), 1)).toBe(true);
  await settled(page, '[data-testid="app-root"]', bg);
  await expect(pop.getByRole("button", { name: "Light" })).toHaveCount(0);
});

test("Match system on a light computer gives the same Paper look", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/?sample");
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "aura");
  await expect(page.locator("html")).toHaveAttribute("data-aura-theme", "paper");
  await settled(page, '[data-testid="app-root"]', hexRgb(paperToken("bg")));
  await page.getByRole("button", { name: "Appearance" }).click();
  await expect(page.getByRole("dialog", { name: "Appearance" }).getByRole("button", { name: "Paper" })).toHaveAttribute("aria-pressed", "true");
  await ctx.close();
});

test("the splash banner dots are drawn in the paper ink and show against the splash card", async ({ page }) => {
  await openPaper(page);
  await page.getByRole("button", { name: "Appearance" }).click(); // close the popover
  await page.getByTestId("file-input").setInputFiles(IMAGE_FILE);
  await page.evaluate(() => window.__collide!.seedShape({ x: 20, y: 20, w: 80, h: 40 }));
  await page.getByRole("button", { name: "Close sample-400x300.png", exact: true }).click();
  const splash = page.getByRole("alertdialog");
  await expect(splash).toBeVisible();
  const px = await splash.locator("canvas.banner").evaluate((cv: HTMLCanvasElement) => {
    const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
    const count = new Map<string, number>();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) count.set(`${d[i]},${d[i + 1]},${d[i + 2]}`, (count.get(`${d[i]},${d[i + 1]},${d[i + 2]}`) ?? 0) + 1);
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    return { opaque: [...count.values()].reduce((a, b) => a + b, 0), top: top?.[0].split(",").map(Number) ?? [0, 0, 0] };
  });
  expect(px.opaque).toBeGreaterThan(200);
  const dots: Rgba = [px.top[0], px.top[1], px.top[2], 255];
  expect(near(dots, hexRgb(paperToken("ink")), 3)).toBe(true);
  await expect.poll(async () => contrast(dots, await groundOf(page, ".splashcard"))).toBeGreaterThan(3);
});

test("the Recents day labels are visible in Paper", async ({ page }) => {
  await openPaper(page);
  const label = page.getByTestId("sidebar").locator(".sec .label").first();
  await expect(label).toBeVisible();
  const c = await colorOf(page, label);
  expect(c[3]).toBeGreaterThan(200);
  await expect.poll(async () => contrast(await colorOf(page, label), await groundOf(page, '[data-testid="sidebar"]'))).toBeGreaterThan(3);
  // Aura labels carry the count in braces, as in the other Aura grounds.
  await expect(label).toHaveText(/\{\d\d\}/);
});

test("screenshots of Paper, Lichen, Ash, Slate and Dark", async ({ page }) => {
  await page.goto("/?sample");
  await page.getByRole("button", { name: "Appearance" }).click();
  const pop = page.getByRole("dialog", { name: "Appearance" });
  for (const name of ["Paper", "Lichen", "Ash", "Slate", "Dark"]) {
    await pop.getByRole("button", { name }).click();
    await expect(pop.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    // Tracked files: written only on request (T52_SHOTS=1), not on every run.
    if (process.env.T52_SHOTS) await page.screenshot({ path: `${SHOTS}${name.toLowerCase()}.png`, animations: "disabled" });
  }
});

test("Match system follows the computer live: no other interaction after the switch", async ({ page }) => {
  await page.goto("/?sample");
  await page.getByRole("button", { name: "Appearance" }).click();
  const pop = page.getByRole("dialog", { name: "Appearance" });
  await expect(pop.getByRole("switch", { name: "Match system" })).toHaveAttribute("aria-checked", "true");
  const html = page.locator("html");
  const label = page.getByTestId("sidebar").locator(".sec .label").first();
  const ground = hexRgb(paperToken("bg"));
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-app-theme", "aura");
  await expect(html).toHaveAttribute("data-aura-theme", "paper");
  await expect(pop.getByRole("button", { name: "Paper" })).toHaveAttribute("aria-pressed", "true");
  await expect(pop.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
  await expect(label).toHaveText(/\{\d\d\}/);
  await settled(page, '[data-testid="app-root"]', ground);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-app-theme", "dark");
  await expect(html).not.toHaveAttribute("data-aura-theme", /.*/);
  await expect(pop.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  await expect(pop.getByRole("button", { name: "Paper" })).toHaveAttribute("aria-pressed", "false");
  await expect(label).not.toHaveText(/\{\d\d\}/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-app-theme", "aura");
  await expect(html).toHaveAttribute("data-aura-theme", "paper");
  await expect(pop.getByRole("button", { name: "Paper" })).toHaveAttribute("aria-pressed", "true");
  await expect(label).toHaveText(/\{\d\d\}/);
});
