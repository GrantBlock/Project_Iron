// `pnpm ref`: the reference harness (RUN.md, L02). Runs the reference specs in
// ../reference/specs, unchanged and with their own Playwright config, twice:
//   1. against the prototype (file://…/prototype/exports/P16-lite/index.html, the specs' default)
//   2. against the app: the renderer build (dist/) under `vite preview` on a free local port, in Chromium
// Each run saves its screenshots in ../reference/shots/<target>/. Then it prints a table per
// spec (prototype ✓ ✗, app ✓ ✗), compares the screenshot pairs and writes
// ../reports/screenshot-diff.md (pairs above 2% are listed, not failed).
//
// Options: --no-build (reuse dist/), --strict (exit 1 when an app spec fails as well),
// --only=prototype|app; anything else goes to `playwright test` (e.g. a spec file name).
// Exit code: 1 if any spec fails on the prototype (a bad spec), or a run did not complete.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { compareDirs, diffReport } from "../src/tools/screenshot-diff.ts";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const referenceDir = path.resolve(appDir, "../reference");
const reportsDir = path.resolve(appDir, "../reports");
const shotsDir = path.join(referenceDir, "shots");
const resultsDir = path.join(appDir, "test-results", "ref");
const THRESHOLD = 2;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const only = (argv.find((a) => a.startsWith("--only=")) || "").slice("--only=".length);
const passThrough = argv.filter((a) => !["--no-build", "--strict"].includes(a) && !a.startsWith("--only="));
const targets = ["prototype", "app"].filter((t) => !only || t === only);

/** Runs the reference specs with LITE_TARGET_* set; resolves to the JSON report path. */
function runSpecs(target, url) {
  const json = path.join(resultsDir, `${target}.json`);
  rmSync(json, { force: true });
  rmSync(path.join(shotsDir, target), { recursive: true, force: true });
  // The specs import @playwright/test. Use the reference folder's own install if it has one
  // (one copy of Playwright per run); otherwise this app's, found through NODE_PATH.
  const cwd = existsSync(path.join(referenceDir, "node_modules", "@playwright", "test")) ? referenceDir : appDir;
  const env = {
    ...process.env,
    NODE_PATH: [path.join(appDir, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    LITE_TARGET_NAME: target,
    PLAYWRIGHT_JSON_OUTPUT_FILE: json,
  };
  if (url) env.LITE_TARGET_URL = url;
  else delete env.LITE_TARGET_URL;
  delete env.LITE_SHOTS_DIR;
  const args = [
    "exec", "playwright", "test",
    "-c", path.join(referenceDir, "playwright.config.ts"),
    "--reporter=dot,json",
    "--output", path.join(resultsDir, target),
    ...passThrough,
  ];
  console.log(`\n[ref] ${target}: ${url || "the prototype (file://)"}`);
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, { cwd, env, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", () => resolve(json));
  });
}

/** Flattens Playwright's JSON report to { "<file> › <title path>": passed }. */
function readResults(json) {
  if (!existsSync(json)) return null;
  const report = JSON.parse(readFileSync(json, "utf8"));
  const out = new Map();
  const walk = (suite, titles) => {
    const here = suite.title && !suite.title.endsWith(".ts") ? [...titles, suite.title] : titles;
    for (const spec of suite.specs || []) out.set(`${spec.file} › ${[...here, spec.title].join(" › ")}`, spec.ok === true);
    for (const child of suite.suites || []) walk(child, here);
  };
  for (const suite of report.suites || []) walk(suite, []);
  return out;
}

const mark = (v) => (v === undefined ? "—" : v ? "✓" : "✗");

mkdirSync(resultsDir, { recursive: true });
const results = {};
if (targets.includes("prototype")) {
  results.prototype = readResults(await runSpecs("prototype", null));
}
if (targets.includes("app")) {
  if (!flag("--no-build")) await build({ root: appDir, logLevel: "warn" });
  // Port 0: the system picks a free port, so runs in other checkouts (e.g. a reviewer's worktree) never collide.
  const server = await preview({ root: appDir, logLevel: "warn", preview: { host: "127.0.0.1", port: 0, strictPort: true, open: false } });
  try {
    const address = server.httpServer.address();
    if (!address || typeof address === "string") throw new Error("vite preview has no port");
    results.app = readResults(await runSpecs("app", `http://127.0.0.1:${address.port}/`));
  } finally {
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
}

// Table: one row per spec, grouped by file.
const keys = [...new Set([...(results.prototype?.keys() ?? []), ...(results.app?.keys() ?? [])])];
const width = Math.min(96, Math.max(...keys.map((k) => k.length), 10));
console.log(`\n${"Spec".padEnd(width)}  prototype  app`);
for (const k of keys) {
  console.log(`${(k.length > width ? k.slice(0, width - 1) + "…" : k).padEnd(width)}  ${mark(results.prototype?.get(k)).padEnd(9)}  ${mark(results.app?.get(k))}`);
}
const files = [...new Set(keys.map((k) => k.split(" › ")[0]))];
const count = (map, file) => {
  if (!map) return "—";
  const rows = [...map].filter(([k]) => !file || k.startsWith(file + " › "));
  return `${rows.filter(([, ok]) => ok).length}/${rows.length}`;
};
console.log(`\n${"File".padEnd(20)}  prototype  app`);
for (const f of files) console.log(`${f.padEnd(20)}  ${count(results.prototype, f).padEnd(9)}  ${count(results.app, f)}`);
console.log(`${"Total".padEnd(20)}  ${count(results.prototype).padEnd(9)}  ${count(results.app)}`);

// Screenshots: only when both targets ran.
if (results.prototype && results.app) {
  const pairs = compareDirs(path.join(shotsDir, "prototype"), path.join(shotsDir, "app"));
  mkdirSync(reportsDir, { recursive: true });
  const report = path.join(reportsDir, "screenshot-diff.md");
  writeFileSync(report, diffReport(pairs, { threshold: THRESHOLD, date: new Date().toISOString().slice(0, 10) }));
  const over = pairs.filter((p) => p.percent === null || p.percent > THRESHOLD);
  console.log(`\nScreenshots: ${pairs.length} pairs, ${over.length} above ${THRESHOLD}% or missing (listed, not failed).`);
  for (const p of pairs) console.log(`  ${p.name.padEnd(40)} ${p.percent === null ? "—" : p.percent.toFixed(2) + "%"} ${p.note}`);
  console.log(`Report: ${path.relative(process.cwd(), report)}`);
}

const protoBad = !results.prototype && targets.includes("prototype") ? true : [...(results.prototype?.values() ?? [])].some((ok) => !ok);
const appBad = !results.app && targets.includes("app") ? true : [...(results.app?.values() ?? [])].some((ok) => !ok);
if (protoBad) console.error("\n[ref] A spec fails on the prototype: that is a bad spec, not an app bug.");
process.exit(protoBad || (flag("--strict") && appBad) ? 1 : 0);
