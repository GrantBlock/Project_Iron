import { describe, expect, it } from "vitest";
import { activateTab, activeTab, closeTab, cycleTab, noTabs, openTab, patchTab, type Tab, type TabsState } from "./tabs";

const tab = (id: string, extra: Partial<Tab> = {}): Tab => ({ id, key: `k:${id}`, kind: "snip", title: id.toUpperCase(), dirty: false, ...extra });
const three = (): TabsState => ["a", "b", "c"].reduce((s, id) => openTab(s, tab(id)), noTabs);

describe("tabs", () => {
  it("opening adds a tab at the right and brings it to the front", () => {
    const s = three();
    expect(s.tabs.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(activeTab(s)?.id).toBe("c");
  });

  it("opening the same thing again goes to its tab instead of adding one", () => {
    const s = openTab(three(), tab("zz", { key: "k:a" }));
    expect(s.tabs).toHaveLength(3);
    expect(s.active).toBe("a");
  });

  it("closing the tab in front shows the one that takes its place, else the last", () => {
    expect(closeTab(activateTab(three(), "a"), "a").active).toBe("b");
    expect(closeTab(activateTab(three(), "b"), "b").active).toBe("c");
    expect(closeTab(three(), "c").active).toBe("b");
  });

  it("closing another tab keeps the one in front; the last tab closed leaves the blank canvas", () => {
    const s = closeTab(three(), "a");
    expect(s.active).toBe("c");
    expect(closeTab(closeTab(s, "b"), "c")).toEqual({ tabs: [], active: null });
    expect(closeTab(s, "nope")).toBe(s);
  });

  it("Ctrl+Tab and Ctrl+Shift+Tab wrap round", () => {
    const s = three();
    expect(cycleTab(s, 1).active).toBe("a");
    expect(cycleTab(cycleTab(s, 1), -1).active).toBe("c");
    expect(cycleTab(activateTab(s, "a"), -1).active).toBe("c");
    const one = openTab(noTabs, tab("a"));
    expect(cycleTab(one, 1)).toBe(one);
  });

  it("a tab's changed mark and title can be patched; no change keeps the same state object", () => {
    const s = three();
    const d = patchTab(s, "b", { dirty: true });
    expect(d.tabs.map((t) => t.dirty)).toEqual([false, true, false]);
    expect(patchTab(d, "b", { dirty: true })).toBe(d);
    expect(patchTab(d, "nope", { dirty: true })).toBe(d);
  });
});
