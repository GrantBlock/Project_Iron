// The read-only test hook `window.__lite.state()` (../reference/HOOK.md), the same shape the
// prototype's hook returns. Built from the app state; the two facts that only the page knows
// (whether the window is under 900px, how many <mark>s the page shows) come from `env`.
import { PACKAGE } from "./data/sample";
import { listedItems, openFolderNames, selectedItem, viewInfo, pathText, type AppState, type Store } from "./state";
import type { ViewType } from "./data/sample";

export interface HookMessage {
  role: "user" | "assistant";
  text: string;
  citations: number;
  sources: number;
}

export interface HookState {
  selected: { id: string | null; type: ViewType; title: string; path: string };
  openFolders: string[];
  view: { type: ViewType; page: number | null; pageCount: number | null };
  search: { query: string; matchCount: number; highlights: number };
  assistantShown: boolean;
  tab: "files" | "view" | "assistant" | null;
  messages: HookMessage[];
}

export interface HookEnv {
  /** True under 900px (the Files / View / Assistant tabs show). */
  narrow: boolean;
  /** <mark> elements on the current page. */
  highlights: number;
}

/** Message text as shown, without the citation chips: "[n]" markers removed, spaces collapsed. */
export function messageText(text: string): string {
  return text.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

export function snapshot(s: AppState, env: HookEnv): HookState {
  const listed = listedItems(s);
  const item = selectedItem(s);
  const view = viewInfo(s);
  const inTree = !item || listed.some((i) => i.id === item.id);
  return {
    selected: { id: inTree ? s.selected : null, type: view.type, title: item ? item.title : PACKAGE.title, path: pathText(s) },
    openFolders: openFolderNames(s),
    view: { ...view },
    search: { query: s.query, matchCount: listed.length, highlights: env.highlights },
    assistantShown: s.assistantShown,
    tab: env.narrow ? (s.pane === "chat" ? "assistant" : s.pane) : null,
    messages: s.messages.map((m) => ({
      role: m.role,
      text: messageText(m.text),
      citations: (m.text.match(/\[\d+\]/g) ?? []).length,
      sources: m.sources.length,
    })),
  };
}

declare global {
  interface Window {
    /** The read-only test hook (HOOK.md). */
    __lite?: { readonly state: () => HookState };
  }
}

/** Installs `window.__lite` (frozen; reading it changes nothing). */
export function installHook(store: Store, env: () => HookEnv): void {
  const hook = Object.freeze({ state: () => snapshot(store.get(), env()) });
  Object.defineProperty(window, "__lite", { value: hook, configurable: true, writable: false, enumerable: false });
}
