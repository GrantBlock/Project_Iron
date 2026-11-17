import { describe, expect, it } from "vitest";
import type { AnnotationsDoc } from "../model";
import { filterRecents, flatFiles, folderBase, groupRecents, patchZipFile, pictureNames, snipMeta, sortFolders, storeRow, withPicture, zipFile, type RecentItem } from "./recents";
import { sampleRecents, sampleDoc, SAMPLE_SNIPS } from "./sample";

const today = new Date(2026, 10, 15, 9, 30);
const doc: AnnotationsDoc = {
  version: 1,
  source: { kind: "image", width: 320, height: 200 },
  shapes: [
    { id: "a1", type: "rect", x: 1, y: 2, w: 3, h: 4, stroke: "#FF3D1F", strokeWidth: 3, callout: 1, note: "Loose bracket" },
    { id: "a2", type: "ellipse", x: 1, y: 2, w: 3, h: 4, stroke: "#FF3D1F", strokeWidth: 3 },
  ],
};

describe("Recents rows", () => {
  it("a saved markup folder becomes a row: Today when its date is today, else Earlier", () => {
    const row = storeRow("C:\\Users\\g\\Documents\\Collide\\Markups\\2026-11-15_pump-skid", today, doc);
    expect(row).toMatchObject({ id: "markup:2026-11-15_pump-skid", name: "2026-11-15_pump-skid", day: "Today", callouts: 1, width: 320, height: 200, notes: ["Loose bracket"] });
    expect(snipMeta(row)).toBe("1 callout · 320 × 200");
    expect(storeRow("/home/g/Documents/Collide/Markups/2026-11-12_valve/", today).day).toBe("Earlier");
    expect(snipMeta(storeRow("x/odd-name", today))).toBe("Markup");
    expect(folderBase("a/b/c/")).toBe("c");
  });

  it("folders sort newest first by their date prefix", () => {
    expect(sortFolders(["/m/2026-11-12_a", "/m/2026-11-15_b", "/m/2026-11-13_c"])).toEqual(["/m/2026-11-15_b", "/m/2026-11-13_c", "/m/2026-11-12_a"]);
  });

  it("the sample rows are the prototype's: three snips and two zips, Today and Earlier", () => {
    const rows = sampleRecents();
    expect(rows.map((r) => r.name)).toEqual(["Line 3 conveyor guard", "HMI header grid", "P&ID V-101 tag", "builder-v0.1.zip", "collide-run-2-notes.zip"]);
    expect(groupRecents(rows).map((g) => [g.day, g.rows.map((r) => r.name)])).toEqual([
      ["Today", ["Line 3 conveyor guard", "HMI header grid", "builder-v0.1.zip"]],
      ["Earlier", ["P&ID V-101 tag", "collide-run-2-notes.zip"]],
    ]);
    const line3 = rows[0];
    expect(line3.kind === "snip" && snipMeta(line3)).toBe("4 callouts · 1280 × 720");
  });

  it("search matches the name, a note or a tag; a group with no rows is left out", () => {
    const rows = sampleRecents();
    expect(filterRecents(rows, "weld").map((r) => r.name)).toEqual(["Line 3 conveyor guard"]);
    expect(filterRecents(rows, "P&ID").map((r) => r.name)).toEqual(["P&ID V-101 tag"]);
    expect(filterRecents(rows, " ZIP ").map((r) => r.name)).toEqual(["builder-v0.1.zip", "collide-run-2-notes.zip"]);
    expect(filterRecents(rows, "")).toHaveLength(5);
    expect(groupRecents(filterRecents(rows, "P&ID")).map((g) => g.day)).toEqual(["Earlier"]);
    expect(groupRecents([] as RecentItem[])).toEqual([]);
  });

  it("a zip's files are found by path", () => {
    const zip = sampleRecents().find((r) => r.kind === "zip")!;
    if (zip.kind !== "zip") throw new Error("not a zip");
    const files = flatFiles(zip.tree, zip.id);
    expect(files.map((f) => f.path)).toContain("z-builder/design/specs/P06-Project-Workspace-Spec.md");
    expect(files.find((f) => f.name === "P06-Project-Workspace-Spec.md")).toMatchObject({ type: "md" });
    expect(files).toHaveLength(8);
  });

  it("a sample snip opens as a real annotations doc: numbered back to front, sized to the picture", () => {
    const d = sampleDoc(SAMPLE_SNIPS[0]);
    expect(d.source).toEqual({ kind: "image", width: 1280, height: 720 });
    expect(d.shapes.map((s) => [s.type, s.callout, s.fill ?? false])).toEqual([["rect", 1, false], ["ellipse", 2, false], ["rect", 3, true], ["point", 4, false]]);
    expect(d.shapes[0]).toMatchObject({ x: 428, y: 236, w: 192, h: 148, note: "Guard bracket cracked at the weld. Re-weld before next PM." });
    expect(sampleDoc(SAMPLE_SNIPS[1]).shapes[1]).toMatchObject({ type: "cross", hideBubble: true });
  });
});

describe("a zip's files for the Markdown editor (RUN3 T34)", () => {
  const zip = sampleRecents().find((r) => r.kind === "zip" && r.id === "z-builder");
  if (zip?.kind !== "zip") throw new Error("sample zip missing");

  it("finds a file by its path from the zip's root", () => {
    expect(zipFile(zip.tree, "images/line-3-conveyor-guard.png")?.sample).toBe("s-line3");
    expect(zipFile(zip.tree, "design/specs/P06-Project-Workspace-Spec.md")?.marks).toHaveLength(2);
    expect(zipFile(zip.tree, "images")).toBeNull(); // a folder is no file
    expect(zipFile(zip.tree, "images/none.png")).toBeNull();
  });

  it("adds a picture to images/ (made when missing) without changing the old tree", () => {
    const t = withPicture(zip.tree, "pasted-1.png", "data:image/png;base64,AA");
    expect(pictureNames(t)).toEqual(new Set(["line-3-conveyor-guard.png", "pasted-1.png"]));
    expect(pictureNames(zip.tree).has("pasted-1.png")).toBe(false);
    const bare = withPicture({ name: "z", kids: [{ name: "a.md", type: "md", text: "" }] }, "p.png", "data:image/png;base64,AA");
    expect(zipFile(bare, "images/p.png")?.url).toBe("data:image/png;base64,AA");
  });

  it("saves a file's text and marks into the tree", () => {
    const t = patchZipFile(zip.tree, "design/specs/P06-Project-Workspace-Spec.md", { text: "# New", marks: [] });
    expect(zipFile(t, "design/specs/P06-Project-Workspace-Spec.md")).toMatchObject({ text: "# New", marks: [] });
    expect(zipFile(zip.tree, "design/specs/P06-Project-Workspace-Spec.md")?.text).not.toBe("# New");
    expect(patchZipFile(zip.tree, "design/specs", { text: "x" })).toEqual(zip.tree); // folders are left alone
  });
});
