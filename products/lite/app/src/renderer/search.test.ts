import { describe, expect, it } from "vitest";
import { allItems } from "./data/sample";
import { filterItems, matches, normalizeQuery } from "./search";
import { initialState, select, setQuery, toggleFolder, treeFolders } from "./state";
import { snapshot } from "./hook";

const ids = (q: string) => filterItems(allItems(), q).map((i) => i.id);

describe("search: matching", () => {
  it("an empty or blank query matches everything", () => {
    expect(ids("")).toHaveLength(7);
    expect(ids("   ")).toHaveLength(7);
  });

  it("ignores case, in titles, document pages and note text", () => {
    expect(ids("ROD DIAMETER")).toEqual(["n1"]);
    expect(ids("Gearbox")).toEqual(["d2", "d3"]); // title of d2; page text of d3; the process document names none
    expect(ids("oil")).toEqual(["d2", "d3"]);
    expect(ids("cylinder")).toEqual(["n1"]);
    expect(ids("pneumatic")).toEqual(["n1", "d3"]);
    expect(ids("guard")).toEqual(["d3", "m2"]); // LOTO page text, then the guard layout title (tree order)
  });

  it("several words are one phrase, in order (as the prototype)", () => {
    expect(ids("mounting position")).toEqual(["d2"]);
    expect(ids("position mounting")).toEqual([]);
    expect(ids("  zero energy ")).toEqual(["d3"]);
  });

  it("no results", () => {
    expect(ids("zzzz-nothing")).toEqual([]);
  });

  it("models match by title only (they have no text)", () => {
    expect(ids("transfer axis")).toEqual([]);
    expect(ids("frame v4")).toEqual(["m1"]);
  });

  it("works on any { id, title, pages?, text? } list (L08 feeds files from disk)", () => {
    const files = [
      { id: "f1", title: "readme.md", text: "Torque spec: 40 N·m" },
      { id: "f2", title: "manual.pdf", pages: ["Intro", "Torque table"] },
      { id: "f3", title: "part.glb" },
    ];
    expect(filterItems(files, "torque").map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(filterItems(files, "GLB").map((f) => f.id)).toEqual(["f3"]);
    expect(matches(files[1], "intro torque")).toBe(true); // pages are joined with a space, as the prototype
    expect(normalizeQuery("  a b ")).toBe("a b");
  });
});

describe("search: tree and hook", () => {
  it("folder counts follow the filter and empty folders disappear", () => {
    const counts = (q: string) => treeFolders(setQuery(initialState(), q)).map((f) => [f.project.name, f.items.length]);
    expect(counts("pneumatic")).toEqual([["Palletizer retrofit", 1], ["Engineering resources", 1]]);
    expect(counts("cylinder")).toEqual([["Palletizer retrofit", 1]]);
    expect(counts("zzzz")).toEqual([]);
  });

  it("matchCount, openFolders and a selection that is filtered out", () => {
    let s = select(initialState(), "n2");
    s = setQuery(s, "gearbox");
    const snap = snapshot(s, { narrow: false, highlights: 0 });
    expect(snap.search).toEqual({ query: "gearbox", matchCount: 2, highlights: 0 });
    expect(snap.selected.id).toBeNull();
    expect(snap.openFolders).toEqual(["Palletizer retrofit", "Engineering resources"]);
    expect(snapshot(setQuery(s, ""), { narrow: false, highlights: 0 }).search.matchCount).toBe(7);
  });

  it("searching keeps collapsed folders collapsed (Grant 2026-11-17, ISSUES.md 3)", () => {
    const s = setQuery(toggleFolder(initialState(), "Palletizer retrofit"), "o");
    expect(treeFolders(s).map((f) => [f.project.name, f.open])).toEqual([
      ["Palletizer retrofit", false],
      ["Engineering resources", true],
    ]);
    expect(treeFolders(setQuery(s, "")).map((f) => f.open)).toEqual([false, true]);
  });

  it("opening a result carries the trimmed query as the page highlight", () => {
    // The tree passes the trimmed query to select (ui/left.ts); here the same call.
    const s = setQuery(initialState(), " oil ");
    expect(select(s, "d2", { highlight: normalizeQuery(s.query) }).highlight).toBe("oil");
  });
});
