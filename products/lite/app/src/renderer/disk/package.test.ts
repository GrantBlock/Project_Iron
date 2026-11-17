import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { FolderListing } from "../bridge";
import { snapshot } from "../hook";
import { filterItems } from "../search";
import { diskTree, initialState, itemById, openDisk, pathText, select, setQuery, toggleFolder, viewInfo } from "../state";
import { NOT_OPENED, TOO_LARGE, loadPackage, packageItems } from "./package";

const glb = readFileSync(fileURLToPath(new URL("../assets/models/m2.glb", import.meta.url)));
const listing: FolderListing = {
  name: "Site files",
  truncated: false,
  entries: [
    { path: "drawings", name: "drawings", kind: "folder" },
    { path: "drawings/empty", name: "empty", kind: "folder" },
    { path: "drawings/guard.glb", name: "guard.glb", kind: "glb", size: glb.byteLength },
    { path: "data.bin", name: "data.bin", kind: "other", size: 4 },
    { path: "guide.md", name: "guide.md", kind: "markdown", size: 40 },
    { path: "huge.pdf", name: "huge.pdf", kind: "pdf", size: 60 * 1024 * 1024 },
    { path: "log.txt", name: "log.txt", kind: "text", size: 9 },
    { path: "report.pdf", name: "report.pdf", kind: "pdf", size: 100 },
  ],
};
const files: Record<string, Uint8Array> = {
  "drawings/guard.glb": glb,
  "guide.md": new TextEncoder().encode("# Guide\n\nCheck the sprocket. <b>not bold</b>"),
  "log.txt": new TextEncoder().encode("Shift log"),
  "report.pdf": new TextEncoder().encode("%PDF"),
};
const reads: string[] = [];
const readers = {
  read: async (p: string) => {
    reads.push(p);
    const f = files[p];
    if (!f) throw new Error("no such file");
    return f;
  },
  pdfPages: async () => ["Torque check, page one", "Flange bolts on page two"],
};

describe("loadPackage", async () => {
  const pkg = await loadPackage(listing, readers);

  it("builds the folder tree, folders first", () => {
    expect(pkg.name).toBe("Site files");
    expect(pkg.root.folders.map((f) => [f.path, f.folders.map((x) => x.path), f.files.map((x) => x.title)])).toEqual([["drawings", ["drawings/empty"], ["guard.glb"]]]);
    expect(packageItems(pkg).map((i) => i.id)).toEqual(["f:drawings/guard.glb", "f:data.bin", "f:guide.md", "f:huge.pdf", "f:log.txt", "f:report.pdf"]);
  });

  it("turns each kind into an item the views and search understand", () => {
    const by = (id: string) => packageItems(pkg).find((i) => i.id === id)!;
    expect(by("f:report.pdf")).toMatchObject({ type: "document", pages: ["Torque check, page one", "Flange bolts on page two"], source: { kind: "pdf" } });
    expect(by("f:guide.md")).toMatchObject({ type: "note", text: "# Guide\n\nCheck the sprocket. <b>not bold</b>", source: { kind: "markdown" } });
    expect(by("f:log.txt")).toMatchObject({ type: "note", text: "Shift log" });
    expect(by("f:drawings/guard.glb")).toMatchObject({ type: "model", parts: [{ name: "Guard panel", bodies: "4 bodies" }, { name: "Door interlock", bodies: "2 bodies" }] });
    expect(by("f:data.bin")).toMatchObject({ type: "note", source: { kind: "other", problem: NOT_OPENED } });
    expect(by("f:huge.pdf")).toMatchObject({ type: "note", source: { kind: "pdf", problem: TOO_LARGE } });
  });

  it("never reads files it does not open (other types, too large)", () => {
    expect(reads).not.toContain("data.bin");
    expect(reads).not.toContain("huge.pdf");
  });

  it("an unreadable file is listed with the reason", async () => {
    const broken = await loadPackage({ name: "x", truncated: false, entries: [{ path: "bad.glb", name: "bad.glb", kind: "glb", size: 3 }] }, { ...readers, read: async () => new Uint8Array([1, 2, 3]) });
    expect(packageItems(broken)[0]).toMatchObject({ type: "note", source: { problem: "Lite could not read this GLB." } });
  });

  it("search covers PDF, Markdown and text", () => {
    const ids = (q: string) => filterItems(packageItems(pkg), q).map((i) => i.id);
    expect(ids("flange")).toEqual(["f:report.pdf"]);
    expect(ids("SPROCKET")).toEqual(["f:guide.md"]);
    expect(ids("shift")).toEqual(["f:log.txt"]);
  });

  it("state: second package in the tree, path bar, views, search and the hook", () => {
    let s = openDisk(initialState(), pkg);
    expect(diskTree(s)?.count).toBe(6);
    s = select(s, "f:report.pdf", { page: 1 });
    expect(pathText(s)).toBe("Site files / report.pdf");
    expect(viewInfo(s)).toEqual({ type: "document", page: 2, pageCount: 2 });
    expect(pathText(select(s, "f:drawings/guard.glb"))).toBe("Site files / drawings / guard.glb");
    expect(itemById(s, "f:nope")).toBeUndefined();
    expect(select(s, "f:nope")).toBe(s);

    const snap = snapshot(s, { narrow: false, highlights: 0 });
    expect(snap.search.matchCount).toBe(7 + 6);
    expect(snap.openFolders).toEqual(["Palletizer retrofit", "Engineering resources", "Site files", "drawings", "empty"]);
    expect(snapshot(toggleFolder(s, "disk:drawings"), { narrow: false, highlights: 0 }).openFolders).toEqual(["Palletizer retrofit", "Engineering resources", "Site files"]);

    const found = setQuery(s, "flange");
    expect(snapshot(found, { narrow: false, highlights: 0 }).search.matchCount).toBe(1);
    expect(diskTree(found)?.folders).toEqual([]);
    expect(diskTree(setQuery(s, "zzzz"))).toBeNull();
  });

  it("opening another folder replaces the first; an open file of it falls back to About", () => {
    const s = select(openDisk(initialState(), pkg), "f:log.txt");
    const next = openDisk(s, { name: "Other", truncated: false, root: { name: "Other", path: "", folders: [], files: [] } });
    expect(next.selected).toBe("about");
    expect(diskTree(next)?.name).toBe("Other");
    const keep = openDisk(select(s, "d1"), pkg);
    expect(keep.selected).toBe("d1");
  });
});
