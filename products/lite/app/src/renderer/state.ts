// The app's state and the changes to it, as pure functions (unit-tested in Node), plus a
// tiny store the render modules subscribe to. Behaviour follows the prototype
// (prototype/exports/P16-lite/index.html), including its quirks listed in ../ISSUES.md.
import { ABOUT_LABEL, ASSISTANT_TEXT, PROJECTS, findItem, projectOf, type Item, type Project, type Source, type ViewType } from "./data/sample";
import { isDiskId, packageItems, type DiskFolder, type DiskPackage } from "./disk/package";
import { filterItems, normalizeQuery } from "./search";

/** The panes under 900px. "chat" is the Assistant pane (the prototype's name). */
export type Pane = "files" | "view" | "chat";

/** "about" or an item id. */
export type SelectionId = string;

export interface Message {
  readonly role: "user" | "assistant";
  /** Answer text; `[n]` marks a citation chip for `sources[n - 1]`. */
  readonly text: string;
  readonly sources: readonly Source[];
}

export interface AppState {
  readonly selected: SelectionId;
  /** Current page of a document, 0-based. */
  readonly page: number;
  /** What is typed in Search this package. */
  readonly query: string;
  /** The term highlighted on the page (set when a result is opened from a search). */
  readonly highlight: string;
  /** Names of collapsed folders. */
  readonly closedFolders: readonly string[];
  readonly assistantShown: boolean;
  /** The pane shown under 900px; kept above 900px too, as in the prototype. */
  readonly pane: Pane;
  /** The Assistant conversation, greeting first. */
  readonly messages: readonly Message[];
  /** The three suggested questions show until the first question is asked. */
  readonly suggestionsShown: boolean;
  /** The part selected in a model view (parts list or viewer); cleared when another item opens. */
  readonly part: string | null;
  /** The folder opened from disk (L08), shown as a second package under the sample; null until one is opened. */
  readonly disk: DiskPackage | null;
  /** Counts every open (tree row, citation, source row): the view redraws and scrolls to the top on each, as the prototype's open(). */
  readonly opened: number;
}

export const ABOUT = "about";

export function initialState(): AppState {
  return {
    selected: ABOUT,
    page: 0,
    query: "",
    highlight: "",
    closedFolders: [],
    assistantShown: true,
    pane: "files",
    messages: [{ role: "assistant", text: ASSISTANT_TEXT.greeting, sources: [] }],
    suggestionsShown: true,
    part: null,
    disk: null,
    opened: 0,
  };
}

/** The selected item, or undefined for About (or an unknown id). */
export function selectedItem(s: AppState): Item | undefined {
  return s.selected === ABOUT ? undefined : itemById(s, s.selected);
}

/** A sample item, or a file of the opened folder. */
export function itemById(s: AppState, id: string): Item | undefined {
  if (!isDiskId(id)) return findItem(id);
  return s.disk ? packageItems(s.disk).find((i) => i.id === id) : undefined;
}

/**
 * Shows an opened folder as the second package (one at a time: it replaces the previous one).
 * If a file of the previous folder was open, About opens instead.
 */
export function openDisk(s: AppState, disk: DiskPackage): AppState {
  const wasDisk = isDiskId(s.selected);
  return {
    ...s,
    disk,
    closedFolders: s.closedFolders.filter((k) => !k.startsWith(DISK_KEY)),
    ...(wasDisk ? { selected: ABOUT, page: 0, highlight: "", part: null, opened: s.opened + 1 } : {}),
  };
}

/**
 * Opens About or an item at `page`. As the prototype: the tree is rebuilt, so every folder opens
 * again (ISSUES.md 3), and under 900px the View pane is shown.
 */
export function select(s: AppState, id: SelectionId, options: { page?: number; highlight?: string; narrow?: boolean } = {}): AppState {
  if (id !== ABOUT && !itemById(s, id)) return s;
  return {
    ...s,
    selected: id,
    page: options.page ?? 0,
    highlight: options.highlight ?? "",
    closedFolders: [],
    pane: options.narrow ? "view" : s.pane,
    part: null,
    opened: s.opened + 1,
  };
}

/** Selects a part of the open model (null clears). */
export function selectPart(s: AppState, part: string | null): AppState {
  return part === s.part ? s : { ...s, part };
}

/** Asking a question: the user's message goes in and the suggestions go away. */
export function askQuestion(s: AppState, question: string): AppState {
  return { ...s, messages: [...s.messages, { role: "user", text: question, sources: [] }], suggestionsShown: false };
}

/** The Assistant's answer arrives. */
export function addAnswer(s: AppState, answer: { text: string; sources: readonly Source[] }): AppState {
  return { ...s, messages: [...s.messages, { role: "assistant", text: answer.text, sources: answer.sources }] };
}

/** Collapses or expands a folder; the selection stays. */
export function toggleFolder(s: AppState, name: string): AppState {
  const closed = s.closedFolders.includes(name);
  return { ...s, closedFolders: closed ? s.closedFolders.filter((n) => n !== name) : [...s.closedFolders, name] };
}

/** The title bar's Assistant button. */
export function toggleAssistant(s: AppState): AppState {
  return { ...s, assistantShown: !s.assistantShown };
}

export function setPane(s: AppState, pane: Pane): AppState {
  return { ...s, pane };
}

/** Typing in Search this package. As the prototype, the tree is rebuilt, so folders open again. */
export function setQuery(s: AppState, query: string): AppState {
  return { ...s, query, closedFolders: [] };
}

/** Previous and Next on a document page (clamped). */
export function turnPage(s: AppState, delta: number): AppState {
  const item = selectedItem(s);
  if (!item || item.type !== "document") return s;
  const page = Math.min(Math.max(s.page + delta, 0), item.pages.length - 1);
  return page === s.page ? s : { ...s, page };
}

/** A folder as the tree shows it: the project and its listed items. */
export interface TreeFolder {
  readonly project: Project;
  readonly items: readonly Item[];
  readonly open: boolean;
}

/**
 * The folders and items the tree lists: the items that match Search this package (search.ts);
 * folders with no matching item are left out. An empty search lists everything.
 */
export function treeFolders(s: AppState): TreeFolder[] {
  return PROJECTS.map((project) => ({ project, items: filterItems(project.items, s.query), open: !s.closedFolders.includes(project.name) })).filter(
    (f) => f.items.length > 0,
  );
}

/** The path bar: the folders leading to the item, and the item's title (null for About). */
export function pathParts(s: AppState): { folders: string[]; title: string | null } {
  const item = selectedItem(s);
  if (!item) return { folders: [], title: null };
  if (item.source && s.disk) return { folders: [s.disk.name, ...item.source.path.split("/").slice(0, -1)], title: item.title };
  const project = projectOf(item.id);
  return { folders: project ? [project.name] : [], title: item.title };
}

/** The path bar text: "Folder / Item", or "About this package". */
export function pathText(s: AppState): string {
  const { folders, title } = pathParts(s);
  return title === null ? ABOUT_LABEL : [...folders, title].join(" / ");
}

/** Keys of the opened folder's groups in `closedFolders`: "disk:" + the folder's relative path. */
export const DISK_KEY = "disk:";

/** A folder of the opened package as the tree shows it. */
export interface DiskTreeNode {
  readonly key: string;
  readonly name: string;
  readonly open: boolean;
  /** Listed files in this folder and its sub-folders. */
  readonly count: number;
  readonly folders: readonly DiskTreeNode[];
  readonly files: readonly Item[];
}

/**
 * The opened folder as the tree lists it: files that match the search; while searching, folders
 * with no match are left out (as the sample's). Null when no folder is open or nothing matches.
 */
export function diskTree(s: AppState): DiskTreeNode | null {
  if (!s.disk) return null;
  const searching = normalizeQuery(s.query) !== "";
  const walk = (f: DiskFolder): DiskTreeNode | null => {
    const key = DISK_KEY + f.path;
    const files = filterItems(f.files, s.query);
    const folders = f.folders.map(walk).filter((n): n is DiskTreeNode => n !== null);
    const count = files.length + folders.reduce((sum, n) => sum + n.count, 0);
    if (searching && count === 0) return null;
    return { key, name: f.name, open: !s.closedFolders.includes(key), count, folders, files };
  };
  return walk(s.disk.root);
}

/** Every item the tree lists (sample and opened folder), whether or not its folder is collapsed. */
export function listedItems(s: AppState): Item[] {
  const out = treeFolders(s).flatMap((f) => f.items);
  const walk = (n: DiskTreeNode) => {
    out.push(...n.files);
    n.folders.forEach(walk);
  };
  const disk = diskTree(s);
  if (disk) walk(disk);
  return out;
}

/** Names of the expanded folders the tree shows: the sample's, then the opened folder's. */
export function openFolderNames(s: AppState): string[] {
  const out = treeFolders(s).filter((f) => f.open).map((f) => f.project.name);
  const walk = (n: DiskTreeNode) => {
    if (!n.open) return;
    out.push(n.name);
    n.folders.forEach(walk);
  };
  const disk = diskTree(s);
  if (disk) walk(disk);
  return out;
}

export interface ViewInfo {
  readonly type: ViewType;
  /** 1-based; null unless a document. */
  readonly page: number | null;
  readonly pageCount: number | null;
}

export function viewInfo(s: AppState): ViewInfo {
  const item = selectedItem(s);
  if (!item) return { type: "about", page: null, pageCount: null };
  if (item.type === "document") return { type: "document", page: s.page + 1, pageCount: item.pages.length };
  return { type: item.type, page: null, pageCount: null };
}

export type Listener = (state: AppState, previous: AppState) => void;

export interface Store {
  get(): AppState;
  /** Applies a change; listeners run when the state object changes. */
  update(change: (s: AppState) => AppState): void;
  subscribe(listener: Listener): () => void;
}

export function createStore(initial: AppState = initialState()): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    update(change) {
      const previous = state;
      const next = change(state);
      if (next === previous) return;
      state = next;
      for (const l of listeners) l(state, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
