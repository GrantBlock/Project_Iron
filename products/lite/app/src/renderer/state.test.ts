import { describe, expect, it } from "vitest";
import {
  ABOUT,
  createStore,
  initialState,
  pathText,
  select,
  setPane,
  setQuery,
  toggleAssistant,
  toggleFolder,
  treeFolders,
  turnPage,
  viewInfo,
} from "./state";

describe("state", () => {
  it("starts on About with every folder open and the Assistant shown", () => {
    const s = initialState();
    expect(s.selected).toBe(ABOUT);
    expect(pathText(s)).toBe("About this package");
    expect(viewInfo(s)).toEqual({ type: "about", page: null, pageCount: null });
    expect(treeFolders(s).map((f) => [f.project.name, f.open, f.items.length])).toEqual([
      ["Palletizer retrofit", true, 4],
      ["Engineering resources", true, 3],
    ]);
    expect(s.assistantShown).toBe(true);
    expect(s.pane).toBe("files");
  });

  it("selecting an item sets the path and view, from page 1", () => {
    const s = select(initialState(), "d2");
    expect(pathText(s)).toBe("Palletizer retrofit / GB-220 gearbox data sheet");
    expect(viewInfo(s)).toEqual({ type: "document", page: 1, pageCount: 6 });
    expect(viewInfo(select(s, "m2"))).toEqual({ type: "model", page: null, pageCount: null });
    expect(pathText(select(s, "n2"))).toBe("Engineering resources / Handoff log template");
    expect(viewInfo(select(s, "d3", { page: 2 }))).toEqual({ type: "document", page: 3, pageCount: 3 });
  });

  it("ignores unknown ids", () => {
    const s = initialState();
    expect(select(s, "nope")).toBe(s);
  });

  it("under 900px, selecting shows the View pane; above, the pane stays", () => {
    expect(select(initialState(), "d1", { narrow: true }).pane).toBe("view");
    expect(select(initialState(), "d1").pane).toBe("files");
  });

  it("folders collapse and expand independently; collapsing keeps the selection", () => {
    let s = select(initialState(), "n1");
    s = toggleFolder(s, "Palletizer retrofit");
    expect(treeFolders(s).map((f) => f.open)).toEqual([false, true]);
    expect(s.selected).toBe("n1");
    s = toggleFolder(s, "Engineering resources");
    expect(treeFolders(s).map((f) => f.open)).toEqual([false, false]);
    s = toggleFolder(s, "Palletizer retrofit");
    expect(treeFolders(s).map((f) => f.open)).toEqual([true, false]);
  });

  it("folders keep their open/closed state on select, search and clearing the search (Grant 2026-11-17, ISSUES.md 3)", () => {
    const closed = toggleFolder(initialState(), "Engineering resources");
    expect(select(closed, "d1").closedFolders).toEqual(["Engineering resources"]);
    expect(select(closed, "d3").closedFolders).toEqual(["Engineering resources"]); // an item inside the closed folder
    expect(select(closed, "about").closedFolders).toEqual(["Engineering resources"]);
    const searching = setQuery(closed, "oil");
    expect(searching.closedFolders).toEqual(["Engineering resources"]);
    expect(treeFolders(searching).map((f) => [f.project.name, f.open])).toEqual([
      ["Palletizer retrofit", true],
      ["Engineering resources", false],
    ]);
    const cleared = setQuery(searching, "");
    expect(treeFolders(cleared).map((f) => f.open)).toEqual([true, false]);
    // Opening a result from the search keeps them too.
    expect(select(searching, "d2", { highlight: "oil" }).closedFolders).toEqual(["Engineering resources"]);
  });

  it("toggles the Assistant and switches panes", () => {
    const s = toggleAssistant(initialState());
    expect(s.assistantShown).toBe(false);
    expect(toggleAssistant(s).assistantShown).toBe(true);
    expect(setPane(s, "chat").pane).toBe("chat");
  });

  it("turns document pages within the document only", () => {
    let s = select(initialState(), "d1");
    s = turnPage(s, -1);
    expect(s.page).toBe(0);
    s = turnPage(turnPage(turnPage(s, 1), 1), 1);
    expect(viewInfo(s).page).toBe(3);
    const note = select(initialState(), "n1");
    expect(turnPage(note, 1)).toBe(note);
  });

  it("the store notifies on change only", () => {
    const store = createStore();
    const seen: string[] = [];
    const off = store.subscribe((s, prev) => seen.push(`${prev.selected}->${s.selected}`));
    store.update((s) => select(s, "m1"));
    store.update((s) => s);
    store.update((s) => select(s, "nope"));
    off();
    store.update((s) => select(s, "d1"));
    expect(seen).toEqual(["about->m1"]);
    expect(store.get().selected).toBe("d1");
  });
});
