import type { FullConfig, Reporter, Suite } from "@playwright/test/reporter";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { OUT_DIR, type Target } from "./targets";

// Prints, per spec, how it did on the prototype and on the app, and writes the same to reference-out/report.json.
// A spec that fails on the prototype is a bad spec (RUN3), so those are listed apart.
type Mark = "✓" | "✗" | "–";
interface Row {
  file: string;
  title: string;
  prototype: Mark;
  app: Mark;
}

const TARGETS: Target[] = ["prototype", "app"];

export default class ReferenceReporter implements Reporter {
  private suite: Suite | null = null;
  private testDir = "";

  onBegin(config: FullConfig, suite: Suite) {
    this.suite = suite;
    this.testDir = config.projects[0]?.testDir ?? config.rootDir;
  }

  onEnd() {
    const rows = new Map<string, Row>();
    for (const t of this.suite?.allTests() ?? []) {
      const project = t.parent.project()?.name as Target | undefined;
      if (!project || !TARGETS.includes(project)) continue;
      const file = relative(this.testDir, t.location.file).replace(/\\/g, "/");
      // titlePath: "", project, file, then describe blocks and the test title.
      const title = t.titlePath().slice(3).join(" › ");
      const key = `${file}\n${title}`;
      const row = rows.get(key) ?? { file, title, prototype: "–", app: "–" };
      const outcome = t.outcome();
      // Flaky (passed on a retry) is not a pass here: a reference spec must pass every time.
      row[project] = outcome === "expected" ? "✓" : outcome === "skipped" ? "–" : "✗";
      rows.set(key, row);
    }
    const list = [...rows.values()].sort((a, b) => a.file.localeCompare(b.file) || a.title.localeCompare(b.title));
    const count = (target: Target, mark: Mark) => list.filter((r) => r[target] === mark).length;
    const total = (target: Target) => `${target} ${count(target, "✓")}/${list.length - count(target, "–")} ✓`;
    const bad = list.filter((r) => r.prototype === "✗");

    const lines = ["", "Reference: each spec on the prototype and on the app", ""];
    for (const r of list) lines.push(`  ${r.file} › ${r.title}: prototype ${r.prototype} · app ${r.app}`);
    lines.push("", `  Totals: ${TARGETS.map(total).join(" · ")}   (– = not run)`);
    if (bad.length) lines.push(`  Bad specs (fail on the prototype, fix the spec): ${bad.length}`, ...bad.map((r) => `    ${r.file} › ${r.title}`));
    lines.push("");
    console.log(lines.join("\n"));

    const out = join(fileURLToPath(new URL("..", import.meta.url)), OUT_DIR);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "report.json"), JSON.stringify({ specs: list, totals: Object.fromEntries(TARGETS.map((t) => [t, { passed: count(t, "✓"), failed: count(t, "✗"), notRun: count(t, "–") }])) }, null, 2) + "\n");
  }

  printsToStdio() {
    return false;
  }
}
