// T49 (tests first, Lydia): a Markdown tab is one live CodeMirror 6 editor on the page, no Edit / Preview. Written before the code.
// Assumed selectors: `.cm-editor` > `.cm-content` inside the Workspace region (contenteditable); one `.cm-line` per source line;
// the Markdown marks (#, **, `, >, -, |, [](), 1.) are `.md-mark` spans, always in the DOM and dimmed (a colour that differs from the text,
// or opacity < 1); a heading line has the line class `md-h1` .. `md-h6`; bold text `.md-strong`; italic `.md-em`; inline code `.md-code`.
import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NAME = "P06-Project-Workspace-Spec.md";
const FIXTURE = fileURLToPath(new URL("../tests/fixtures/sample-400x300.png", import.meta.url));
const ws = (page: Page) => page.getByRole("region", { name: "Workspace" });
const recents = (page: Page) => page.getByRole("complementary", { name: "Recents" });
const state = (page: Page) => page.evaluate(() => window.__collide!.state());
const lines = (page: Page) => ws(page).locator(".cm-line");
const text = async (page: Page) => (await lines(page).allTextContents()).join("\n");
const content = (page: Page) => ws(page).locator(".cm-content");

async function newFile(page: Page) {
  await page.goto("/");
  await recents(page).getByRole("button", { name: "New file" }).click();
  await ws(page).locator(".cm-content").waitFor();
  await content(page).click();
}
async function openP06(page: Page) {
  await page.goto("/?sample");
  await recents(page).getByRole("button", { name: NAME, exact: true }).click();
  await ws(page).getByRole("toolbar", { name: "Markdown tools" }).waitFor();
}
/** Type a block with marks in one go (insertText: no auto-pairing, no key by key surprises). */
async function fill(page: Page) {
  await page.keyboard.insertText("# Title");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Some **bold** and *soft* and `code` here");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("- item one");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("plain line");
}

test.describe("one view", () => {
  test("no Edit / Preview toggle, no textarea: one editor on the page", async ({ page }) => {
    await openP06(page);
    await expect(ws(page).getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await expect(ws(page).getByRole("button", { name: "Preview", exact: true })).toHaveCount(0);
    await expect(ws(page).locator("textarea")).toHaveCount(0);
    await expect(ws(page).locator(".cm-editor")).toHaveCount(1);
    await expect(content(page)).toHaveAttribute("contenteditable", "true");
    expect(await text(page)).toContain("# P06 Project Workspace Spec");
  });

  test("typing changes the text and marks the tab Unsaved", async ({ page }) => {
    await newFile(page);
    await page.keyboard.insertText("hello world");
    expect(await text(page)).toBe("hello world");
    await expect(page.getByRole("tab").getByLabel("Unsaved changes")).toBeVisible();
    await page.keyboard.press("Control+s");
    await expect(page.getByRole("tab").getByLabel("Saved", { exact: true })).toBeVisible();
  });

  test("undo and redo with Ctrl+Z and Ctrl+Y", async ({ page }) => {
    await newFile(page);
    await page.keyboard.insertText("one");
    await page.waitForTimeout(600); // CodeMirror groups quick edits into one history step
    await page.keyboard.insertText(" two");
    expect(await text(page)).toBe("one two");
    await page.keyboard.press("Control+z");
    expect(await text(page)).toBe("one");
    await page.keyboard.press("Control+y");
    expect(await text(page)).toBe("one two");
  });
});

test.describe("marks stay visible, styled in place", () => {
  test("every mark is in the DOM and dimmed, also on lines the caret is not on", async ({ page }) => {
    await newFile(page);
    await fill(page);
    // The caret is on the last line: the marks of the other lines are still there.
    const first = lines(page).nth(0);
    await expect(first.locator(".md-mark")).toHaveText("#");
    expect(await first.textContent()).toBe("# Title");
    const second = lines(page).nth(1);
    expect(await second.locator(".md-mark").allTextContents()).toEqual(expect.arrayContaining(["**", "**", "*", "*", "`", "`"]));
    await expect(lines(page).nth(2).locator(".md-mark").first()).toHaveText("-");
    // Dimmed: the mark's colour or opacity differs from the line's text.
    const dimmed = await second.evaluate((line) => {
      const mark = line.querySelector(".md-mark") as HTMLElement;
      const a = getComputedStyle(mark);
      const b = getComputedStyle(line);
      return a.color !== b.color || Number(a.opacity) < 1;
    });
    expect(dimmed).toBe(true);
    // The caret moving onto a line does not hide or show anything.
    await first.click();
    await expect(first.locator(".md-mark")).toHaveText("#");
    await expect(second.locator(".md-mark")).not.toHaveCount(0);
  });

  test("headings, bold, italic and code are styled in place", async ({ page }) => {
    await newFile(page);
    await fill(page);
    const first = lines(page).nth(0);
    await expect(first).toHaveClass(/md-h1/);
    const [hSize, pSize] = await page.evaluate(() => {
      const size = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
      const h = document.querySelector(".cm-line.md-h1")!;
      const p = [...document.querySelectorAll(".cm-line")].find((l) => l.textContent === "plain line")!;
      return [size(h), size(p)];
    });
    expect(hSize).toBeGreaterThan(pSize);
    const strong = lines(page).nth(1).locator(".md-strong");
    await expect(strong).toContainText("bold");
    expect(await strong.evaluate((el) => Number(getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(600);
    expect(await lines(page).nth(1).locator(".md-em").evaluate((el) => getComputedStyle(el).fontStyle)).toBe("italic");
    const code = lines(page).nth(1).locator(".md-code");
    await expect(code).toContainText("code");
    expect(await code.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/mono/i);
  });
});

test.describe("the text tools act on the selection or the line", () => {
  const tool = (page: Page) => ws(page).getByRole("group", { name: "Text tools" });

  test("Heading, List, Num list, Label on the caret's line", async ({ page }) => {
    await newFile(page);
    await page.keyboard.insertText("alpha");
    await tool(page).getByRole("combobox", { name: "Heading" }).selectOption("2");
    expect(await text(page)).toBe("## alpha");
    await content(page).click();
    await tool(page).getByRole("button", { name: "Bulleted list" }).click();
    expect(await text(page)).toBe("- alpha");
    await tool(page).getByRole("button", { name: "Numbered list" }).click();
    expect(await text(page)).toBe("1. alpha");
    await tool(page).getByRole("button", { name: "Label line", exact: false }).click();
    expect(await text(page)).toBe("**Label:** alpha");
  });

  test("Bold wraps the selection, Link makes [text](url), Table goes in", async ({ page }) => {
    await newFile(page);
    await page.keyboard.insertText("make this bold");
    await page.keyboard.press("Home");
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowRight");
    await tool(page).getByRole("button", { name: "Bold" }).click();
    expect(await text(page)).toBe("make **this** bold");
    await page.keyboard.press("End");
    await page.keyboard.press("Shift+Control+ArrowLeft");
    await tool(page).getByRole("button", { name: "Link" }).click();
    expect(await text(page)).toBe("make **this** [bold](url)");
    await page.keyboard.press("Control+End");
    await tool(page).getByRole("button", { name: "Insert a table" }).click();
    expect(await text(page)).toContain("| Item | Owner | Status |");
    expect(await text(page)).toContain("| --- | --- | --- |");
    await page.keyboard.press("Control+z");
    expect(await text(page)).not.toContain("| Item |");
  });
});

test.describe("pictures", () => {
  test("Insert image saves into images/ and links it at the caret", async ({ page }) => {
    await newFile(page);
    await page.keyboard.insertText("before");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("after");
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("End"); // the caret is at the end of line 1
    await ws(page).locator('input[type="file"]').setInputFiles(FIXTURE);
    await expect(page.getByRole("status")).toContainText("saved to images/sample-400x300.png and linked");
    await expect(recents(page).getByRole("button", { name: "sample-400x300.png", exact: true })).toBeVisible();
    const t = await text(page);
    expect(t.split("\n")[0]).toBe("before");
    expect(t).toContain("![sample-400x300](images/sample-400x300.png)");
    expect(t.indexOf("![sample")).toBeLessThan(t.indexOf("after"));
    expect((await state(page)).tabs[0].dirty).toBe(true);
  });

  test("a pasted picture is saved into images/ and linked at the caret", async ({ page }) => {
    await newFile(page);
    await page.keyboard.insertText("top");
    const bytes = [...readFileSync(FIXTURE)];
    await content(page).evaluate((el, data) => {
      const file = new File([new Uint8Array(data)], "image.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, bytes);
    await expect(page.getByRole("status")).toContainText(/pasted-\d{6}\.png/);
    expect(await text(page)).toMatch(/!\[pasted-\d{6}\]\(images\/pasted-\d{6}\.png\)/);
    expect((await text(page)).startsWith("top")).toBe(true);
  });
});

test.describe("drawing tools and typing", () => {
  async function draw(page: Page) {
    const h1 = (await ws(page).locator(".md-h1").first().boundingBox())!;
    await page.mouse.move(h1.x + 40, h1.y + 120);
    await page.mouse.down();
    await page.mouse.move(h1.x + 140, h1.y + 170, { steps: 4 });
    await page.mouse.up();
  }

  test("with a drawing tool on, a drag draws on the page and typing does not change the text; with Select, typing is text", async ({ page }) => {
    await openP06(page);
    const before = await text(page);
    const items0 = (await state(page)).items.length;
    await ws(page).getByRole("button", { name: "Rectangle", exact: true }).click();
    expect((await state(page)).activeTool).toBe("rect");
    await draw(page);
    expect((await state(page)).items.length).toBe(items0 + 1);
    expect(await text(page)).toBe(before);
    await page.keyboard.type("zzz");
    expect(await text(page)).toBe(before);
    await ws(page).getByRole("button", { name: "Select", exact: true }).click();
    await content(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("zzz");
    expect(await text(page)).toBe(before + "zzz");
    expect((await state(page)).items.length).toBe(items0 + 1);
  });

  test("a callout stays at its page coordinates when text above it changes", async ({ page }) => {
    await openP06(page);
    await ws(page).getByRole("button", { name: "Rectangle", exact: true }).click();
    await draw(page);
    const mine = async () => (await state(page)).items[0]; // front to back: the newest drawing is first
    const before = await mine();
    await ws(page).getByRole("button", { name: "Select", exact: true }).click();
    await lines(page).nth(0).click();
    await page.keyboard.press("Home");
    for (let i = 0; i < 4; i++) await page.keyboard.press("Enter"); // text above the callout grows
    const after = await mine();
    expect([after.x, after.y, after.w, after.h]).toEqual([before.x, before.y, before.w, before.h]);
  });
});

test.describe("copy, save, fit and zoom", () => {
  test("Copy, Save as MD / TXT / PNG / JPEG / PDF and Save source still work, with the text as typed", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await newFile(page);
    await fill(page);
    const typed = await text(page);
    await ws(page).getByRole("button", { name: "Copy to clipboard", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(/^Copied .* as a PNG · \d+ × \d+$/);
    await ws(page).getByRole("button", { name: "Save as" }).click();
    const names = await page.getByRole("menu", { name: "Save as" }).getByRole("menuitem").allTextContents();
    expect(names).toEqual(["PNG", "JPEG", "PDF", "TXT", "MD"]);
    const dl = page.waitForEvent("download");
    await page.getByRole("menu", { name: "Save as" }).getByRole("menuitem", { name: "MD" }).click();
    const file = await (await dl).path();
    expect(readFileSync(file, "utf8")).toBe(typed);
    const src = page.waitForEvent("download");
    await ws(page).getByRole("button", { name: "Save source", exact: true }).click();
    const zip = unzipSync(new Uint8Array(readFileSync(await (await src).path())));
    expect(Object.keys(zip).some((k) => k.startsWith("sources/") && k.endsWith(".md"))).toBe(true);
    await expect(page.getByRole("tab").getByLabel("Saved", { exact: true })).toBeVisible();
  });

  test("Ctrl+0 and F fit; Ctrl + wheel zooms the page", async ({ page }) => {
    await openP06(page);
    const zoom = () => page.evaluate(() => window.__collide!.state().zoom);
    await expect.poll(async () => (await zoom())?.fit).toBe(true);
    const fit = (await zoom())!;
    const box = (await ws(page).locator(".cm-content").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 200);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -300);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await zoom())!.fit).toBe(false);
    expect((await zoom())!.percent).toBeGreaterThan(fit.percent);
    await page.keyboard.press("Control+0");
    await expect.poll(zoom).toEqual(fit);
    await page.keyboard.press("Control+=");
    await expect.poll(async () => (await zoom())!.fit).toBe(false);
    // F outside the text fits; an f typed in the text is text.
    await page.mouse.click(5, 5);
    await page.keyboard.press("f");
    await expect.poll(zoom).toEqual(fit);
    await content(page).click();
    const before = await text(page);
    await page.keyboard.press("Control+End");
    await page.keyboard.type("f");
    expect(await text(page)).toBe(before + "f");
  });
});
