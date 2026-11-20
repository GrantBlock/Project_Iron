// Compares the prototype's reference screenshots with the app's same-named ones (RUN3 T37).
//   node reference/compare-shots.mjs [--json]
// Reads reference-out/screens/{prototype,app}/<spec>/<name>-<theme>-<WxH>.png, decodes both in Playwright's
// Chromium (page canvas, no extra dependencies) and counts pixels where any RGBA channel differs by more than 16.
// Tolerance (A): 2% (ISSUES 23). It lists; it never fails on a difference. Exit 1 only for a missing folder.
import { chromium } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)), "reference-out", "screens");
const THRESHOLD = 16;
const TOLERANCE = 2;
const asJson = process.argv.includes("--json");

if (!existsSync(join(ROOT, "prototype")) || !existsSync(join(ROOT, "app"))) {
  console.error(`No screenshots under ${ROOT}. Run "pnpm ref" first.`);
  process.exit(1);
}
const list = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".png")) : []);
const specs = readdirSync(join(ROOT, "prototype"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

// Same preinstalled-Chromium fallback as the Playwright configs.
const preinstalled = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(existsSync(preinstalled) ? { executablePath: preinstalled } : {});
const page = await browser.newPage();
await page.setContent("<canvas id=c></canvas>");
const diff = (a, b) =>
  page.evaluate(
    async ([x, y, thr]) => {
      const load = (b64) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = "data:image/png;base64," + b64;
        });
      const pix = (img) => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, c.width, c.height);
      };
      const [p, q] = [pix(await load(x)), pix(await load(y))];
      if (p.width !== q.width || p.height !== q.height) return { sizeMismatch: `${p.width}x${p.height} vs ${q.width}x${q.height}` };
      let n = 0;
      for (let i = 0; i < p.data.length; i += 4)
        if (Math.abs(p.data[i] - q.data[i]) > thr || Math.abs(p.data[i + 1] - q.data[i + 1]) > thr || Math.abs(p.data[i + 2] - q.data[i + 2]) > thr || Math.abs(p.data[i + 3] - q.data[i + 3]) > thr) n++;
      return { pct: (100 * n) / (p.width * p.height) };
    },
    [readFileSync(a).toString("base64"), readFileSync(b).toString("base64"), THRESHOLD],
  );

const rows = [];
const unpaired = [];
for (const spec of specs) {
  const pd = join(ROOT, "prototype", spec);
  const ad = join(ROOT, "app", spec);
  const [pf, af] = [list(pd), list(ad)];
  for (const f of af) if (!pf.includes(f)) unpaired.push(`app/${spec}/${f}`);
  for (const f of pf.sort()) {
    if (!af.includes(f)) { unpaired.push(`prototype/${spec}/${f}`); continue; }
    const m = /^(.*)-(dark|light|aura-sage|current)-(\d+x\d+)\.png$/.exec(f);
    const r = await diff(join(pd, f), join(ad, f));
    rows.push({ spec, name: m ? m[1] : f, theme: m ? m[2] : "?", size: m ? m[3] : "?", ...r });
  }
}
await browser.close();

const val = (r) => (r.sizeMismatch ? 100 : r.pct);
if (asJson) console.log(JSON.stringify({ threshold: THRESHOLD, tolerance: TOLERANCE, rows, unpaired }, null, 2));
else {
  for (const r of rows) console.log(`${val(r).toFixed(2).padStart(6)}%  ${r.spec}/${r.name} ${r.theme} ${r.size}${r.sizeMismatch ? "  SIZE " + r.sizeMismatch : ""}`);
  const over = rows.filter((r) => val(r) > TOLERANCE);
  console.log(`\n${rows.length} pairs, ${over.length} above ${TOLERANCE}% (listed, not failed). Unpaired: ${unpaired.length}.`);
}
