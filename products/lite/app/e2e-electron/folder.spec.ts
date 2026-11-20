import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./launch";

// L08 (not in the prototype): Open folder with a small fixture folder. The system dialog is
// replaced in the main process for the test (Playwright's app.evaluate), nothing else is.

const appDir = fileURLToPath(new URL("..", import.meta.url));

/** A minimal PDF: one Helvetica text line per page. */
function makePdf(pages: string[]): Buffer {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((text, i) => {
    const stream = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
    objects[pageIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
    objects[pageIds[i] + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out);
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** The fixture: a 2-page PDF, Markdown, text, a GLB in a sub-folder, an unknown file; plus a file and a symlink outside the folder. */
function makeFixture() {
  const base = realpathSync(mkdtempSync(path.join(tmpdir(), "lite-folder-e2e-")));
  const root = path.join(base, "Site files");
  mkdirSync(path.join(root, "drawings"), { recursive: true });
  writeFileSync(path.join(root, "report.pdf"), makePdf(["Torque check on page one", "Flange bolts on page two"]));
  writeFileSync(
    path.join(root, "guide.md"),
    "# Guide\n\nCheck the **sprocket** alignment.\n\n## Steps\n\n- Lock out\n- Check the chain\n\n<script>document.title='pwned'</script><img src=x onerror=alert(1)>\n",
  );
  writeFileSync(path.join(root, "log.txt"), "Shift log: conveyor restarted.\n");
  writeFileSync(path.join(root, "data.bin"), Buffer.from([0, 1, 2, 3, 255]));
  copyFileSync(path.join(appDir, "src/renderer/assets/models/m2.glb"), path.join(root, "drawings", "guard.glb"));
  writeFileSync(path.join(base, "secret.txt"), "outside the folder");
  if (process.platform !== "win32") symlinkSync(path.join(base, "secret.txt"), path.join(root, "link.txt"));
  return { base, root };
}

/** Path → sha256 and mtime of every file under `dir` (no symlinks followed). */
function snapshotFiles(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.isFile()) out[path.relative(dir, p)] = `${createHash("sha256").update(readFileSync(p)).digest("hex")} ${statSync(p).mtimeMs}`;
      else out[path.relative(dir, p)] = "symlink";
    }
  };
  walk(dir);
  return out;
}

async function stubDialog(app: ElectronApplication, folder: string | null) {
  await app.evaluate(({ dialog }, f) => {
    const answer = async () => ({ canceled: f === null, filePaths: f ? [f] : [] });
    (dialog as unknown as { showOpenDialog: unknown }).showOpenDialog = answer;
  }, folder);
}

const tree = (page: Page) => page.getByLabel("Package files");
const viewer = (page: Page) => page.getByRole("main", { name: "Viewer" });
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __lite: { state(): { selected: { id: string | null; path: string }; view: unknown; search: { matchCount: number } } } }).__lite.state());

test("Open folder: the fixture shows as a second package; each type opens; search finds PDF and Markdown text; nothing changes on disk", async () => {
  const { base, root } = makeFixture();
  const before = snapshotFiles(base);
  const { app, page, output, close } = await launch();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  try {
    // Cancelling the dialog changes nothing.
    await stubDialog(app, null);
    await page.getByRole("button", { name: "Open folder" }).click();
    await expect(page.getByRole("button", { name: "Open folder" })).toBeEnabled();
    await expect(tree(page).getByText("Opened folder")).toHaveCount(0);

    await stubDialog(app, root);
    await page.getByRole("button", { name: "Open folder" }).click();
    await expect(tree(page).getByText("Opened folder")).toBeVisible();
    const group = tree(page).getByRole("button", { name: /^Site files/ });
    await expect(group).toHaveAttribute("aria-expanded", "true");
    await expect(group).toContainText("5");
    for (const name of ["report.pdf", "guide.md", "log.txt", "data.bin", "guard.glb"]) await expect(tree(page).getByRole("button", { name, exact: true })).toBeVisible();
    await expect(tree(page).getByRole("button", { name: /^drawings/ })).toBeVisible();
    // Symbolic links are not listed (Linux / macOS).
    await expect(tree(page).getByRole("button", { name: "link.txt" })).toHaveCount(0);
    // The sample package is still there.
    await expect(tree(page).getByRole("button", { name: "Process document, rev 3", exact: true })).toBeVisible();
    expect((await state(page)).search.matchCount).toBe(12);

    // PDF: pages drawn by pdf.js with Previous / Next.
    await tree(page).getByRole("button", { name: "report.pdf", exact: true }).click();
    expect((await state(page)).selected.path).toBe("Site files / report.pdf");
    await expect(viewer(page).getByText("PDF · 2 pages")).toBeVisible();
    await expect(viewer(page).getByText("Page 1 of 2")).toBeVisible();
    const sheet = viewer(page).locator(".l-pdf");
    await expect(sheet).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
    const inked = () =>
      sheet.locator("canvas").evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let dark = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] < 128) dark++;
        return dark;
      });
    expect(await inked()).toBeGreaterThan(100);
    await viewer(page).getByRole("button", { name: "Next" }).click();
    await expect(viewer(page).getByText("Page 2 of 2")).toBeVisible();
    await expect(sheet).toHaveAttribute("data-page", "2", { timeout: 15_000 });
    await expect(viewer(page).getByRole("button", { name: "Next" })).toBeDisabled();
    expect((await state(page)).view).toEqual({ type: "document", page: 2, pageCount: 2 });

    // Markdown (L10): formatted with markdown-it; its raw HTML is text, never markup, and does not run.
    await tree(page).getByRole("button", { name: "guide.md", exact: true }).click();
    await expect(viewer(page).getByText("Markdown · read only")).toBeVisible();
    const md = viewer(page).locator(".l-md");
    await expect(md.getByRole("heading", { name: "Guide", level: 2 })).toBeVisible();
    await expect(md.getByRole("heading", { name: "Steps", level: 3 })).toBeVisible();
    await expect(md.locator("strong")).toHaveText("sprocket");
    await expect(md.getByRole("listitem")).toHaveText(["Lock out", "Check the chain"]);
    await expect(md).toContainText("Check the sprocket alignment.");
    await expect(md).not.toContainText("**");
    await expect(md).toContainText("<script>document.title='pwned'</script><img src=x onerror=alert(1)>");
    await expect(viewer(page).locator("script, img")).toHaveCount(0);
    // Styled with the design tokens: the h2 is bold and larger than the text.
    const looks = await md.evaluate((m) => ({
      h2: Number.parseFloat(getComputedStyle(m.querySelector("h2")!).fontSize),
      p: Number.parseFloat(getComputedStyle(m.querySelector("p")!).fontSize),
      weight: getComputedStyle(m.querySelector("h2")!).fontWeight,
      bullet: getComputedStyle(m.querySelector("ul")!).listStyleType,
    }));
    expect(looks.h2).toBeGreaterThan(looks.p);
    expect(looks).toMatchObject({ weight: "700", bullet: "disc" });
    await page.waitForTimeout(300);
    await expect(page).toHaveTitle("Lite");

    await tree(page).getByRole("button", { name: "log.txt", exact: true }).click();
    await expect(viewer(page).getByText("Shift log: conveyor restarted.")).toBeVisible();

    // Other types are listed, not opened.
    await tree(page).getByRole("button", { name: "data.bin", exact: true }).click();
    await expect(viewer(page).getByText("File · 5 bytes · not opened")).toBeVisible();

    // GLB: the L06 viewer with the file's parts.
    await tree(page).getByRole("button", { name: "guard.glb", exact: true }).click();
    expect((await state(page)).selected.path).toBe("Site files / drawings / guard.glb");
    await expect(viewer(page).locator(".l-viewport")).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
    await expect(viewer(page).getByText("Guard panel", { exact: true })).toBeVisible();
    await expect(viewer(page).getByText("Sample model", { exact: true })).toBeVisible();

    // Search covers the PDF's text and the Markdown.
    const box = page.getByLabel("Search this package");
    await box.fill("flange");
    await expect(tree(page).getByRole("button", { name: "report.pdf", exact: true })).toBeVisible();
    await expect(tree(page).getByRole("button", { name: "guide.md", exact: true })).toHaveCount(0);
    expect((await state(page)).search.matchCount).toBe(1);
    await box.fill("sprocket");
    await expect(tree(page).getByRole("button", { name: "guide.md", exact: true })).toBeVisible();
    expect((await state(page)).search.matchCount).toBe(1);
    // Search looks through the Markdown's visible text: a phrase across formatting matches.
    await box.fill("the sprocket alignment");
    await expect(tree(page).getByRole("button", { name: "guide.md", exact: true })).toBeVisible();
    await box.fill("check the chain");
    expect((await state(page)).search.matchCount).toBe(1);
    await box.fill("");

    // The page cannot read outside the folder through the bridge.
    const refused = await page.evaluate(async () => {
      const lite = (window as unknown as { lite: { readFile(p: string): Promise<Uint8Array> } }).lite;
      const tries = ["../secret.txt", "link.txt", "/etc/hostname", "drawings/../../secret.txt"];
      return Promise.all(tries.map((p) => lite.readFile(p).then(() => `read ${p}`, () => "refused")));
    });
    expect(refused).toEqual(["refused", "refused", "refused", "refused"]);

    expect(requests.filter((u) => !/^(lite:\/\/app\/|data:|blob:)/.test(u))).toEqual([]);
    expect(output()).not.toContain("[lite] blocked");
  } finally {
    await close();
    // Read only: every file is byte-identical (and untouched) afterwards.
    expect(snapshotFiles(base)).toEqual(before);
    rmSync(base, { recursive: true, force: true });
  }
});

/** A 2 × 2 PNG, all one colour. */
function makePng(): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.from([0, 70, 130, 180, 70, 130, 180]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat([row, row]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("L10 Markdown: images show only from inside the opened folder; links show but do not open", async () => {
  const base = realpathSync(mkdtempSync(path.join(tmpdir(), "lite-md-e2e-")));
  const root = path.join(base, "Notes");
  mkdirSync(path.join(root, "docs", "img"), { recursive: true });
  writeFileSync(path.join(root, "docs", "img", "pump.png"), makePng());
  writeFileSync(path.join(base, "outside.png"), makePng());
  writeFileSync(
    path.join(root, "docs", "pump.md"),
    [
      "# Pump",
      "![Pump photo](img/pump.png)",
      "![Outside photo](../../outside.png)",
      "![Remote photo](https://example.com/x.png)",
      "![Data photo](data:image/png;base64,iVBORw0KGgo=)",
      "See the [manual](https://example.com/manual) and [local](img/pump.png).",
      "| Part | Qty |\n| --- | --: |\n| Seal | 2 |",
    ].join("\n\n"),
  );
  const before = snapshotFiles(base);
  const { app, page, output, close } = await launch();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  try {
    await stubDialog(app, root);
    await page.getByRole("button", { name: "Open folder" }).click();
    await tree(page).getByRole("button", { name: "pump.md", exact: true }).click();
    const md = viewer(page).locator(".l-md");
    await expect(md.getByRole("heading", { name: "Pump", level: 2 })).toBeVisible();

    // Inside the folder: drawn from a blob: URL.
    const img = md.getByRole("img", { name: "Pump photo" });
    await expect(img).toBeVisible();
    const blobUrl = (await img.getAttribute("src"))!;
    expect(blobUrl).toMatch(/^blob:lite:\/\/app\//);
    expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(2);
    // Outside the folder, remote, data: the alt text only.
    await expect(md.locator("img")).toHaveCount(1);
    for (const alt of ["Outside photo", "Remote photo", "Data photo"]) await expect(md.locator(".l-md-alt", { hasText: alt })).toBeVisible();

    // Links: text, no href; clicking goes nowhere.
    const link = md.locator(".l-md-link", { hasText: "manual" });
    await expect(link).toBeVisible();
    expect(await md.locator("a[href]").count()).toBe(0);
    await link.click();
    await md.locator(".l-md-link", { hasText: "local" }).click();
    await page.waitForTimeout(300);
    expect(page.url()).toBe("lite://app/");
    expect(await app.windows()).toHaveLength(1);

    await expect(md.locator("td")).toHaveText(["Seal", "2"]);
    await expect(md.locator("td").nth(1)).toHaveCSS("text-align", "right");

    // Another file: the image's blob URL is let go.
    const fetchBlob = () => page.evaluate((u) => fetch(u).then(() => "live", () => "revoked"), blobUrl);
    expect(await fetchBlob()).toBe("live");
    await page.getByRole("button", { name: "About this package" }).click();
    expect(await fetchBlob()).toBe("revoked");
    expect(requests.filter((u) => !/^(lite:\/\/app\/|data:|blob:)/.test(u))).toEqual([]);
    expect(output()).not.toContain("[lite] blocked");
  } finally {
    await close();
    expect(snapshotFiles(base)).toEqual(before);
    rmSync(base, { recursive: true, force: true });
  }
});
