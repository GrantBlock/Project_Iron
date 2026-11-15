import type { Locator, Page } from "@playwright/test";

// Shared steps for the reference specs: visible UI and mouse positions taken from bounding boxes only.

export const LINE3 = "Line 3 conveyor guard";

export const recents = (page: Page) => page.getByRole("complementary", { name: "Recents" });
export const workspace = (page: Page) => page.getByRole("region", { name: "Workspace" });

/** Open a snip from Recents. */
export async function openSnip(page: Page, name: string = LINE3) {
  await recents(page).getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await workspace(page).getByRole("toolbar", { name: "Markup tools" }).waitFor();
}

/** Open the Markdown file P06 from the Recents tree (opens in Edit). */
export async function openMarkdown(page: Page) {
  await recents(page).getByRole("button", { name: "P06-Project-Workspace-Spec.md", exact: true }).click();
  await workspace(page).getByRole("toolbar", { name: "Markdown tools" }).waitFor();
}

/** The snip image on the canvas (the one in the workspace, not a Recents thumbnail). */
export const snipImage = (page: Page, name: string = LINE3) => workspace(page).getByRole("img", { name, exact: true });

export type Box = { x: number; y: number; width: number; height: number };

export async function box(l: Locator): Promise<Box> {
  const b = await l.boundingBox();
  if (!b) throw new Error("element has no box");
  return b;
}

/** Press, move in `steps` and release. */
export async function drag(page: Page, from: [number, number], to: [number, number], steps = 4) {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps });
  await page.mouse.up();
}

/** A wobbly stroke of `n` points starting at (x, y), for the pen. */
export async function scribble(page: Page, x: number, y: number, n = 10, dx = 8, dy = 10) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= n; i++) await page.mouse.move(x + i * dx, y + (i % 2) * dy);
  await page.mouse.up();
}

export const tool = (page: Page, name: string) => workspace(page).getByRole("toolbar").getByRole("button", { name, exact: true });

/**
 * The visible drawing surface of the open editor: the workspace between the toolbar and the Callouts list
 * (Snip: the canvas; Markdown Preview: the scrolling page area). Found from the boxes of things that have roles.
 */
export async function stageBox(page: Page): Promise<Box> {
  const tb = await box(workspace(page).getByRole("toolbar").first());
  const side = await box(workspace(page).getByRole("complementary", { name: "Callouts" }));
  const ws = await box(workspace(page));
  const y = tb.y + tb.height;
  return { x: ws.x, y, width: side.x - ws.x, height: ws.y + ws.height - 30 - y };
}

/**
 * Screen position of a point relative to the middle of the stage, so a spec never uses fixed screen numbers.
 */
export async function atStage(page: Page, dx: number, dy: number): Promise<[number, number]> {
  const s = await stageBox(page);
  return [s.x + s.width / 2 + dx, s.y + s.height / 2 + dy];
}

/**
 * Maps image (or page) pixels to screen positions. Built from one drag the spec made itself:
 * the shape it created (read back with state()) says which image pixel the mouse start was on,
 * and the drag length over the shape's size gives the scale.
 */
export type Mapper = { toScreen: (x: number, y: number) => [number, number]; k: number };
export function mapper(from: [number, number], to: [number, number], item: { x: number; y: number; w: number; h: number }): Mapper {
  const k = (to[0] - from[0]) / item.w;
  return { k, toScreen: (x, y) => [from[0] + (x - item.x) * k, from[1] + (y - item.y) * k] };
}

/**
 * Paste a 320 × 200 PNG, as a paste of an image from the clipboard (the browser gives no real clipboard to a test):
 * a paste event with an image file goes to whatever has the focus. Resolves to whether the page took the paste over
 * (preventDefault was called).
 */
export async function pasteImage(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 200;
    const x = c.getContext("2d")!;
    x.fillStyle = "#1E88E5";
    x.fillRect(0, 0, 320, 200);
    x.fillStyle = "#fff";
    x.font = "40px sans-serif";
    x.fillText("PASTE", 90, 115);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob!], "p.png", { type: "image/png" }));
    const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
    (document.activeElement || document.body).dispatchEvent(ev);
    return ev.defaultPrevented;
  });
}

/** Paste plain text into whatever has the focus; resolves to whether the page took the paste over. */
export async function pasteText(page: Page, text: string): Promise<boolean> {
  return page.evaluate((t) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", t);
    const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
    (document.activeElement || document.body).dispatchEvent(ev);
    return ev.defaultPrevented;
  }, text);
}
