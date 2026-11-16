// Tabs on the canvas (RUN3 T31, Grant 2026-11-15): each open snip, file or Settings is a tab.
// Pure functions over the tab list; the shell keeps each tab's document, undo history and zoom beside it.

/** What a tab shows. The same words as `view` in the reference hook (refState.ts). */
export type TabKind = "snip" | "markdown" | "image" | "file" | "settings";

export interface Tab {
  /** Opaque, unique in this window. */
  id: string;
  /** What the tab is about: opening the same thing again goes to its tab. */
  key: string;
  kind: TabKind;
  title: string;
  /** Unsaved changes: the amber dot. */
  dirty: boolean;
  /** The Recents item it belongs to (a snip id or a zip id), so deleting that item closes the tab. */
  owner?: string;
}

export interface TabsState {
  tabs: Tab[];
  /** Id of the tab in front, or null on the blank canvas. */
  active: string | null;
}

export const noTabs: TabsState = { tabs: [], active: null };

export const activeTab = (s: TabsState): Tab | null => s.tabs.find((t) => t.id === s.active) ?? null;

/** Open a tab, or go to the one that already shows the same thing. */
export function openTab(s: TabsState, tab: Tab): TabsState {
  const had = s.tabs.find((t) => t.key === tab.key);
  if (had) return s.active === had.id ? s : { ...s, active: had.id };
  return { tabs: [...s.tabs, tab], active: tab.id };
}

export function activateTab(s: TabsState, id: string): TabsState {
  return s.active === id || !s.tabs.some((t) => t.id === id) ? s : { ...s, active: id };
}

/** Close a tab. Closing the one in front shows the next tab (the one that takes its place), else the last; no tabs left = blank canvas. */
export function closeTab(s: TabsState, id: string): TabsState {
  const i = s.tabs.findIndex((t) => t.id === id);
  if (i < 0) return s;
  const tabs = s.tabs.filter((t) => t.id !== id);
  if (s.active !== id) return { tabs, active: s.active };
  return { tabs, active: tabs.length ? tabs[Math.min(i, tabs.length - 1)].id : null };
}

/** Ctrl+Tab (1) and Ctrl+Shift+Tab (-1): the next or previous tab, wrapping round. */
export function cycleTab(s: TabsState, dir: 1 | -1): TabsState {
  const i = s.tabs.findIndex((t) => t.id === s.active);
  if (i < 0 || s.tabs.length < 2) return s;
  return { ...s, active: s.tabs[(i + dir + s.tabs.length) % s.tabs.length].id };
}

export function patchTab(s: TabsState, id: string, patch: Partial<Omit<Tab, "id">>): TabsState {
  const t = s.tabs.find((x) => x.id === id);
  if (!t || (Object.keys(patch) as (keyof typeof patch)[]).every((k) => t[k] === patch[k])) return s;
  return { ...s, tabs: s.tabs.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}
