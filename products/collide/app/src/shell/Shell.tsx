// The layout shell (RUN3 T31), after ../../../layout-prototype.html: Recents on the left, a blank canvas as home,
// tabs on the canvas (each keeps its own document, undo steps and zoom), the two ask-first splash screens,
// collapse, themes and the Settings tab. The Snip editor (../editor/EditorShell.tsx) lives inside a Snip tab.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { flushSync } from "react-dom";
import type { AnnotationsDoc, Shape } from "../model";
import { createSnipSession, defaultPen, loadImage, loadPictures, SnipEditor, toPngBytes, type CollideTestState, type SnipEditorApi, type SnipSession } from "../editor/EditorShell";
import { refState, type RefState } from "../editor/refState";
import type { Point } from "../editor/viewport";
import type { Flattened } from "../io/flatten";
import type { StorageInfo } from "../native/bridge";
import { createMarkupStore, MarkupError, type MarkupStore } from "../io";
import {
  collideFileName,
  COLLIDE_EXT,
  dataUrlBytes,
  decodeCollide,
  encodeCollide,
  markdownSummary,
  OPEN_FAILED as COLLIDE_OPEN_FAILED,
  pictureDataUrl,
  pictureLinks,
  picturePath,
  SAVE_FAILED as COLLIDE_SAVE_FAILED,
  snipSummary,
  type CollidePackage,
} from "../io/collideFile";
import { createSnipFlow } from "../snip/flow";
import { electronDeps, isDesktop } from "../snip/electronDeps";
import { Blank, FileTab, SettingsTab, Splash, TabBar, Toasts, WsHead, type FileDoc, type Notice } from "./parts";
import { applyTheme, loadPrefs, savePref, type Prefs } from "./prefs";
import { flatFiles, patchZipFile, PICTURES, pictureNames, sortFolders, storeRow, withPicture, zipFile, type RecentItem, type RecentSnip, type RecentZip, type TreeNode } from "./recents";
import { SAMPLE_OPEN, sampleArt, sampleDoc, sampleRecents, sampleSnip, wantsSample } from "./sample";
import { Sidebar } from "./Sidebar";
import { createMdSession, defaultMdPen, MarkdownEditor, type MdEditorApi, type MdSession } from "../markdown/MarkdownEditor";
import { linkKey, type Resolve } from "../markdown/render";
import { activateTab, activeTab, closeTab, cycleTab, noTabs, openTab, patchTab, type Tab, type TabKind, type TabsState } from "./tabs";

const nameFromUrl = (url: string) => decodeURIComponent(url.split("?")[0].split("/").pop() || "image");
const baseName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? p;

/** Where a saved Collide file is, for the toast (A: beside the markup folders; a browser downloads it). */
const COLLIDE_PLACE = "Documents/Collide/Markups/";

/** A browser has no folder to write to: the file is downloaded. */
function downloadBytes(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A tree with `node` at `rel` (folders made as needed). */
function withFile(tree: TreeNode, rel: string, node: TreeNode): TreeNode {
  const [head, ...rest] = rel.split("/").filter(Boolean);
  const kids = tree.kids ?? [];
  if (rest.length === 0) return { ...tree, kids: [...kids.filter((k) => k.name !== head), { ...node, name: head }] };
  const folder = kids.find((k) => k.name === head && k.kids) ?? { name: head, kids: [] };
  return { ...tree, kids: [...kids.filter((k) => k !== folder), withFile(folder, rest.join("/"), node)] };
}

export interface CollideHook {
  /** The reference test hook (RUN3 T30): read-only, a fresh plain JSON object. The prototype has the same call. */
  state: () => RefState;
  /** Load an image from a URL into a new Snip tab, fitted to the canvas, with no shapes. Resolves with its size. */
  openImage: (url: string, name?: string) => Promise<{ width: number; height: number }>;
  /** Add a test rectangle (image pixels) to the snip in front. Returns its id. */
  seedShape: (s?: Partial<Pick<Shape, "x" | "y" | "w" | "h">>) => string;
  getState: () => CollideTestState;
  /** The annotations doc of the snip in front (image pixels), or null when no snip is in front. */
  getDoc: () => AnnotationsDoc | null;
  /** Convert a point in canvas-container coordinates to image pixels using the current view. */
  screenToImage: (p: Point) => Point;
  /** Open a saved markup in a tab: by folder id, or the picker/most recent when omitted. Resolves with the folder name, or null if cancelled. */
  openMarkup: (folder?: string) => Promise<string | null>;
  /** Save the markup in front. Resolves with the folder id. */
  saveMarkup: () => Promise<string>;
  /** Flatten to a PNG at source size (no download). Resolves with the data URL and its size. */
  exportPng: () => Promise<Flattened>;
  copyFit: () => Promise<Flattened>;
  /** What a finished snip does: open the crop in a new tab, then copy it to the clipboard. */
  openSnip: (url: string, name: string) => Promise<unknown>;
}

declare global {
  interface Window {
    __collide?: CollideHook;
  }
}

type Ask = { kind: "close"; tabId: string } | { kind: "delete"; item: RecentItem };

/** How long a hint and a success message stay (the prototype's toast: 2.6 s). An error stays until dismissed. */
const HINT_MS = 2600;
const SUCCESS_MS = 4000;
/** Recents reads this many of the newest saved markups for their size, callouts and notes. */
const RECENT_DETAILS = 12;

/** A small picture for a sample snip's Recents row. */
const sampleThumb = (id: string) => {
  const s = sampleSnip(id);
  return s ? sampleArt(s, 120) : null;
};

const NO_SNIP: CollideTestState = { image: null, stage: null, shapes: [], shapesOnImage: [], selectedId: null };

export function Shell() {
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [tabs, setTabsState] = useState<TabsState>(noTabs);
  const [ask, setAskState] = useState<Ask | null>(null);
  // What the test hook and the window-level handlers read: always the latest, even before a re-render.
  const live = useRef({ prefs, tabs, ask });
  const setTabs = useCallback((update: (s: TabsState) => TabsState) => {
    const next = update(live.current.tabs);
    if (next === live.current.tabs) return;
    live.current.tabs = next;
    setTabsState(next);
  }, []);
  const setAsk = useCallback((a: Ask | null) => {
    live.current.ask = a;
    setAskState(a);
  }, []);
  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    live.current.prefs = { ...live.current.prefs, [key]: value };
    setPrefsState(live.current.prefs);
    savePref(key, value); // not remembered when storage is blocked; it still applies this session
  }, []);

  // Each tab's own state lives beside the tab list, by tab id.
  const sessions = useRef(new Map<string, SnipSession>());
  const files = useRef(new Map<string, FileDoc>());
  const pen = useRef(defaultPen());
  const editor = useRef<SnipEditorApi | null>(null);
  // Markdown tabs (RUN3 T34): each tab's text, markup and view; one colour and thickness for every Markdown tab.
  const mdSessions = useRef(new Map<string, MdSession>());
  const mdPen = useRef(defaultMdPen());
  const mdEditor = useRef<MdEditorApi | null>(null);
  const [full, setFull] = useState(false);
  const [hideTools, setHideTools] = useState(false);
  const nextId = useRef(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const storeRef = useRef<MarkupStore | null>(null);
  const getStore = useCallback(() => (storeRef.current ??= createMarkupStore()), []);

  // ---------- Toasts ----------
  const [hint, setHint] = useState<string | null>(null);
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const timers = useRef<{ hint?: number; notice?: number }>({});
  const showHint = useCallback((text: string | null) => {
    window.clearTimeout(timers.current.hint);
    setHint(text);
    if (text === null) return;
    // One status message at a time: a hint replaces the last success message (an error stays).
    setNoticeState((n) => (n?.tone === "success" ? null : n));
    timers.current.hint = window.setTimeout(() => setHint(null), HINT_MS);
  }, []);
  const notify = useCallback((n: Notice | null) => {
    window.clearTimeout(timers.current.notice);
    setNoticeState(n);
    if (n?.tone !== "success") return;
    window.clearTimeout(timers.current.hint);
    setHint(null);
    timers.current.notice = window.setTimeout(() => setNoticeState(null), SUCCESS_MS);
  }, []);
  useEffect(() => {
    const t = timers.current;
    return () => {
      window.clearTimeout(t.hint);
      window.clearTimeout(t.notice);
    };
  }, []);
  const fail = useCallback(
    (e: unknown, fallbackTitle: string) => notify({ tone: "error", title: e instanceof MarkupError ? e.title : fallbackTitle, description: e instanceof Error ? e.message : String(e) }),
    [notify],
  );

  // ---------- Theme ----------
  useEffect(() => {
    applyTheme(prefs.theme, prefs.aura);
    if (prefs.theme !== "system" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("system", prefs.aura);
    mq.addEventListener?.("change", follow);
    return () => mq.removeEventListener?.("change", follow);
  }, [prefs.theme, prefs.aura]);
  const themeKey = `${prefs.theme}:${prefs.aura}`;
  useEffect(() => {
    document.body.classList.toggle("compact-bg", prefs.collapsed);
    return () => document.body.classList.remove("compact-bg");
  }, [prefs.collapsed]);

  // The desktop window follows the collapsed layout: windowed, it shrinks to the Recents panel until something is open.
  // Maximized (and in a browser, where the window cannot shrink) the canvas stays beside the panel.
  const [maximized, setMaximized] = useState(true);
  const hasTab = tabs.active !== null;
  useEffect(() => {
    const bridge = window.collide;
    if (typeof bridge?.collapse !== "function") return;
    let on = true;
    let timer: number | undefined;
    const sync = () =>
      void bridge.collapse({ collapsed: prefs.collapsed, canvas: hasTab }).then(
        (r) => on && setMaximized(!!r?.maximized),
        () => undefined,
      );
    sync();
    // Maximizing or restoring the window changes its size: ask again.
    const resized = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(sync, 150);
    };
    window.addEventListener("resize", resized);
    return () => {
      on = false;
      window.clearTimeout(timer);
      window.removeEventListener("resize", resized);
    };
  }, [prefs.collapsed, hasTab]);

  // ---------- Recents ----------
  const [samples, setSamples] = useState<RecentItem[]>(() =>
    wantsSample() ? sampleRecents().map((r) => (r.kind === "snip" && r.source.from === "sample" ? { ...r, thumb: sampleThumb(r.source.sample) } : r)) : [],
  );
  const [stored, setStored] = useState<RecentSnip[]>([]);
  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(() => new Set(wantsSample() ? SAMPLE_OPEN : []));
  const [query, setQuery] = useState("");
  const [pop, setPop] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const listing = useRef(0);
  const refreshRecents = useCallback(async () => {
    const run = ++listing.current;
    const store = getStore();
    let folders: string[];
    try {
      folders = sortFolders((await store.list?.()) ?? []);
    } catch {
      return; // Recents stays as it was; Open still reports the problem
    }
    if (run !== listing.current) return;
    const today = new Date();
    setStored((old) => folders.map((f) => old.find((r) => r.source.from === "store" && r.source.folder === f) ?? storeRow(f, today)));
    // The newest few also show their size, callouts and notes (for Search). A folder that cannot be read keeps its plain row.
    for (const f of folders.slice(0, RECENT_DETAILS)) {
      try {
        const m = await store.open(f);
        if (run !== listing.current) return;
        const row = storeRow(f, today, m.annotations);
        setStored((old) => old.map((r) => (r.id === row.id ? row : r)));
      } catch {
        /* plain row */
      }
    }
  }, [getStore]);
  useEffect(() => {
    void refreshRecents();
    return () => {
      listing.current++;
    };
  }, [refreshRecents]);
  const rows = useMemo<RecentItem[]>(() => [...stored, ...samples], [stored, samples]);

  // ---------- Storage on the server PC (RUN3 T36) ----------
  // The desktop app's main process keeps "keep the newest N" and deletes; Settings → Storage shows its numbers.
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  useEffect(() => {
    const storage = window.collide?.storage;
    if (!storage) return;
    let alive = true;
    storage.info().then(
      (info) => {
        if (!alive) return;
        setStorageInfo(info);
        // The main process holds the number: what this page remembered is replaced by it.
        const keep = info.keep === null ? "" : String(info.keep);
        if (live.current.prefs.settings.keep !== keep) setPref("settings", { ...live.current.prefs.settings, keep });
      },
      () => undefined, // Settings shows the folder without numbers
    );
    return () => {
      alive = false;
    };
  }, [setPref]);
  /** After each save: the main process deletes the oldest beyond N, never what is open in a tab. */
  const pruneStorage = useCallback(async () => {
    const storage = window.collide?.storage;
    if (!storage) return;
    const open: string[] = [];
    for (const t of live.current.tabs.tabs) {
      const snip = sessions.current.get(t.id);
      const md = mdSessions.current.get(t.id);
      for (const name of [snip?.source.folder, snip?.collideFile, md?.collideFile]) if (name) open.push(name);
    }
    try {
      const r = await storage.prune(open);
      setStorageInfo(r.info);
      if (r.deleted.length) {
        showHint(`Deleted the ${r.deleted.length === 1 ? "oldest item" : `${r.deleted.length} oldest items`} to keep the newest ${r.info.keep} · ${r.deleted.join(", ")}`);
        void refreshRecents();
      }
    } catch {
      /* the save itself worked; retention runs again after the next save */
    }
  }, [refreshRecents, showHint]);

  // ---------- A zip's files (RUN3 T34): the Markdown editor's pictures and saves, kept in memory this session ----------
  const samplesRef = useRef(samples);
  samplesRef.current = samples;
  const zipById = (id: string) => samplesRef.current.find((z): z is RecentZip => z.kind === "zip" && z.id === id) ?? null;
  const patchZip = useCallback((id: string, update: (z: RecentZip) => RecentZip) => {
    const next = samplesRef.current.map((z) => (z.kind === "zip" && z.id === id ? update(z) : z));
    samplesRef.current = next;
    setSamples(next);
  }, []);
  const addPicture = useCallback(
    (zipId: string, url: string, name: string) => {
      patchZip(zipId, (z) => ({ ...z, tree: withPicture(z.tree, name, url) }));
      setOpenFolders((o) => new Set([...o, zipId, `${zipId}/${PICTURES}`]));
      return `${PICTURES}/${name}`;
    },
    [patchZip],
  );
  const saveMdFile = useCallback(
    (md: MdSession, text: string, marks: Shape[]) => patchZip(md.zipId, (z) => ({ ...z, tree: patchZipFile(z.tree, md.file.slice(md.zipId.length + 1), { text, marks }) })),
    [patchZip],
  );

  // ---------- Tabs ----------
  const addTab = useCallback(
    (tab: Omit<Tab, "id">, fill?: (id: string) => void) => {
      const had = live.current.tabs.tabs.find((t) => t.key === tab.key);
      const id = had?.id ?? `t${nextId.current++}`;
      if (!had) fill?.(id);
      // Commit synchronously so the tab's editor is on screen when this returns (the test hook relies on it).
      flushSync(() => {
        setTabs((s) => openTab(s, { ...tab, id }));
        setSideOpen(false);
      });
      return id;
    },
    [setTabs],
  );
  const findTab = (key: string) => live.current.tabs.tabs.find((t) => t.key === key) ?? null;
  const dropTab = useCallback(
    (id: string) => {
      setTabs((s) => closeTab(s, id));
      sessions.current.delete(id);
      files.current.delete(id);
      mdSessions.current.delete(id);
    },
    [setTabs],
  );
  /** Close a tab; one with unsaved changes asks first. */
  const requestClose = useCallback(
    (id: string) => {
      const t = live.current.tabs.tabs.find((x) => x.id === id);
      if (!t) return;
      if (t.dirty) setAsk({ kind: "close", tabId: id });
      else dropTab(id);
    },
    [dropTab, setAsk],
  );
  const setDirty = useCallback((id: string, dirty: boolean) => setTabs((s) => patchTab(s, id, { dirty })), [setTabs]);

  const openSnipTab = useCallback(
    (session: SnipSession, tab: { key: string; title: string; owner?: string }) =>
      addTab({ ...tab, kind: "snip", dirty: session.baseDoc === null }, (id) => sessions.current.set(id, session)),
    [addTab],
  );

  const openImage = useCallback(
    async (url: string, name: string) => {
      const img = await loadImage(url, name);
      // Keep the original bytes so source.png is the untouched source image (fetched lazily, awaited on save).
      const bytes = fetch(url).then((r) => r.blob()).then(toPngBytes);
      openSnipTab(createSnipSession(img, bytes), { key: `image:${nextId.current}`, title: name });
      return { width: img.width, height: img.height };
    },
    [openSnipTab],
  );

  // A finished snip opens in a new tab and goes straight to the clipboard, like Snipping Tool.
  // A failed copy only shows its own toast; the snip itself still counts as done.
  const openSnip = useCallback(
    async (url: string, name: string) => {
      const size = await openImage(url, name);
      await editor.current?.copyToClipboard("Snip copied to clipboard");
      return size;
    },
    [openImage],
  );

  const openMarkup = useCallback(
    async (folder?: string): Promise<string | null> => {
      const store = getStore();
      const id = folder ?? (await store.pick());
      if (!id) return null;
      const m = await store.open(id);
      const key = `markup:${m.folderName}`;
      const had = findTab(key);
      if (had) {
        setTabs((s) => activateTab(s, had.id));
        return m.folderName;
      }
      const blob = new Blob([m.sourcePng as BlobPart], { type: "image/png" });
      const img = await loadImage(URL.createObjectURL(blob), m.folderName);
      if (img.width !== m.annotations.source.width || img.height !== m.annotations.source.height) {
        throw new MarkupError(
          "Could not open markup",
          `source.png is ${img.width}×${img.height} but annotations.json says ${m.annotations.source.width}×${m.annotations.source.height}. Restore the matching source.png or re-save the markup.`,
        );
      }
      const pictures = await loadPictures(m.images);
      openSnipTab(createSnipSession(img, Promise.resolve(m.sourcePng), { doc: m.annotations, folder: m.folderName, pictures }), { key, title: m.folderName, owner: key });
      return m.folderName;
    },
    [getStore, openSnipTab, setTabs],
  );

  const openSample = useCallback(
    async (sampleId: string) => {
      const s = sampleSnip(sampleId);
      const key = `sample:${sampleId}`;
      const had = findTab(key);
      if (had) return setTabs((t) => activateTab(t, had.id));
      const art = s && sampleArt(s);
      if (!s || !art) throw new Error("The sample picture could not be drawn.");
      const img = await loadImage(art, s.name);
      const bytes = fetch(art).then((r) => r.blob()).then(toPngBytes);
      openSnipTab(createSnipSession(img, bytes, { doc: sampleDoc(s), folder: null }), { key, title: s.name, owner: s.id });
    },
    [openSnipTab, setTabs],
  );

  const openFile = useCallback(
    (zip: RecentZip, path: string) => {
      const f = flatFiles(zip.tree, zip.id).find((x) => x.path === path);
      if (!f) return null;
      const kind: TabKind = f.type === "md" ? "markdown" : f.type === "image" ? "image" : "file";
      const shown = zip.name + path.slice(zip.id.length);
      if (kind === "markdown") {
        const md = createMdSession({ name: f.name, path: shown, zipId: zip.id, zipName: zip.name, file: path, text: f.text ?? "", shapes: f.marks });
        return addTab({ key: `doc:${path}`, kind, title: f.name, dirty: false, owner: zip.id }, (id) => mdSessions.current.set(id, md));
      }
      const doc: FileDoc = { name: f.name, path: shown, type: f.type ?? "code", text: f.text ?? "" };
      return addTab({ key: `doc:${path}`, kind, title: f.name, dirty: false, owner: zip.id }, (id) => files.current.set(id, doc));
    },
    [addTab],
  );

  // ---------- Collide files (RUN3 T35) ----------
  /** A reopened Markdown package's zip row, by the file it came from. */
  const collideZips = useRef(new Map<string, string>());
  /** Open a .collide package in a tab, editable. `where` is its path (desktop) or null (a file picked in a browser). Resolves with the tab title. */
  const openCollideBytes = useCallback(
    async (bytes: Uint8Array, label: string, where: string | null): Promise<string> => {
      const pkg: CollidePackage = decodeCollide(bytes);
      if (pkg.kind === "snip") {
        const key = `collide:${where ?? `${label}#${nextId.current}`}`;
        const had = findTab(key);
        if (had) {
          setTabs((s) => activateTab(s, had.id));
          return pkg.title;
        }
        const img = await loadImage(URL.createObjectURL(new Blob([pkg.source as BlobPart], { type: "image/png" })), pkg.title).catch(() => {
          throw new MarkupError(COLLIDE_OPEN_FAILED, "sources/source.png cannot be read as a picture. Save it again from Collide, or open another file.");
        });
        if (img.width !== pkg.doc.source.width || img.height !== pkg.doc.source.height) {
          throw new MarkupError(
            COLLIDE_OPEN_FAILED,
            `sources/source.png is ${img.width}×${img.height} but manifest.json says ${pkg.doc.source.width}×${pkg.doc.source.height}. Save it again from Collide, or open another file.`,
          );
        }
        const session = createSnipSession(img, Promise.resolve(pkg.source), { doc: pkg.doc, folder: null, pictures: await loadPictures(pkg.images) });
        session.collideFile = where ?? label;
        openSnipTab(session, { key, title: pkg.title, owner: key });
        return pkg.title;
      }
      // Markdown: the package opens as a zip row in Recents (its .md file and pictures), and its .md file in a tab.
      const zipId = (where && collideZips.current.get(where)) || `collide-${nextId.current++}`;
      if (where) collideZips.current.set(where, zipId);
      let tree: TreeNode = { name: label.replace(/\.collide$/i, ""), kids: [{ name: pkg.file, type: "md", text: pkg.text, marks: pkg.shapes }] };
      for (const pic of pkg.pictures) {
        const url = pictureDataUrl(pic.path, pic.bytes);
        if (url) tree = withFile(tree, pic.path, { name: pic.path, type: "image", url });
      }
      const n = 1 + pkg.pictures.length;
      const zip: RecentZip = { kind: "zip", id: zipId, name: label, day: "Today", meta: `Collide file · ${n} file${n === 1 ? "" : "s"}`, tree };
      const next = [zip, ...samplesRef.current.filter((z) => z.id !== zipId)];
      samplesRef.current = next;
      setSamples(next);
      setOpenFolders((o) => new Set([...o, zipId]));
      const tabId = openFile(zip, `${zipId}/${pkg.file}`);
      const md = tabId ? mdSessions.current.get(tabId) : undefined;
      if (md) md.collideFile = where ?? label;
      return pkg.file;
    },
    [openFile, openSnipTab, setTabs],
  );
  const openCollideFile = useCallback(
    async (file: string) => {
      const bridge = window.collide;
      if (!bridge?.collideFiles) throw new MarkupError(COLLIDE_OPEN_FAILED, "Collide files open in the Collide desktop app.");
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await bridge.collideFiles.open(file));
      } catch (e) {
        throw new MarkupError(COLLIDE_OPEN_FAILED, e instanceof Error ? e.message : String(e));
      }
      return openCollideBytes(bytes, baseName(file), file);
    },
    [openCollideBytes],
  );

  /** Save the tab in front as a .collide file: the desktop app writes it beside the markups; a browser downloads it. */
  const saveCollide = useCallback(async () => {
    const front = activeTab(live.current.tabs);
    if (!front) return;
    let pkg: CollidePackage;
    let summary: string;
    let session: { collideFile?: string };
    if (front.kind === "snip" && editor.current && sessions.current.get(front.id)) {
      session = sessions.current.get(front.id)!;
      pkg = await editor.current.collidePackage(front.title);
      summary = snipSummary(pkg.doc.shapes);
    } else if (front.kind === "markdown" && mdEditor.current && mdSessions.current.get(front.id)) {
      const md = mdSessions.current.get(front.id)!;
      session = md;
      const c = await mdEditor.current.collideContent();
      // The pictures the text links, from the zip, in their own formats.
      const tree = zipById(md.zipId)?.tree;
      const pictures = pictureLinks(c.text).flatMap((link) => {
        const path = picturePath(link);
        const f = path && tree ? zipFile(tree, linkKey(link)) : null;
        const sample = f?.sample ? sampleSnip(f.sample) : undefined;
        const url = f?.url ?? (sample ? sampleArt(sample, 640) : null);
        const bytes = url ? dataUrlBytes(url) : null;
        return path && bytes ? [{ path, bytes }] : [];
      });
      pkg = { kind: "markdown", title: md.name, file: md.name, text: c.text, shapes: c.shapes, pictures, preview: c.preview };
      summary = markdownSummary(c.text, c.shapes);
    } else return;
    const bytes = encodeCollide(pkg);
    const bridge = window.collide;
    const name = session.collideFile ? baseName(session.collideFile) : collideFileName({ kind: pkg.kind, title: pkg.title, file: pkg.kind === "markdown" ? pkg.file : undefined });
    let saved: string;
    let place: string;
    if (bridge?.collideFiles) {
      try {
        saved = await bridge.collideFiles.save(name.toLowerCase().endsWith(COLLIDE_EXT) ? name : `${name}${COLLIDE_EXT}`, bytes, !!session.collideFile);
      } catch (e) {
        throw new MarkupError(COLLIDE_SAVE_FAILED, e instanceof Error ? e.message : String(e));
      }
      place = COLLIDE_PLACE;
    } else {
      downloadBytes(bytes, name);
      saved = name;
      place = "downloaded";
    }
    session.collideFile = saved;
    showHint(`Saved ${baseName(saved)} · ${summary} · ${place}`);
    void pruneStorage();
  }, [pruneStorage, showHint]);
  const onSaveCollide = useCallback(() => {
    notify(null);
    saveCollide().catch((e: unknown) => fail(e, COLLIDE_SAVE_FAILED));
  }, [fail, notify, saveCollide]);

  const openSettings = useCallback(() => void addTab({ key: "settings", kind: "settings", title: "Settings", dirty: false }), [addTab]);

  const openItem = useCallback(
    (item: RecentItem) => {
      if (item.kind === "zip") {
        setOpenFolders((o) => {
          const n = new Set(o);
          if (!n.delete(item.id)) n.add(item.id);
          return n;
        });
        return;
      }
      notify(null);
      const src = item.source;
      const done = src.from === "sample" ? openSample(src.sample) : openMarkup(src.folder);
      done.catch((e: unknown) => fail(e, "Could not open markup"));
    },
    [openSample, openMarkup, notify, fail],
  );

  const onOpen = useCallback(() => {
    notify(null);
    // The desktop app (RUN3 T35): one dialog for a .collide file or a saved markup (its folder or its annotations.json).
    const bridge = window.collide;
    if (bridge?.collideFiles) {
      bridge.collideFiles.pick().then(
        async (r) => {
          if (r?.kind === "markup") {
            const n = await openMarkup(r.folder).catch((e: unknown) => void fail(e, "Could not open markup"));
            if (n) notify({ tone: "success", title: "Markup opened", description: n });
          } else if (r?.kind === "collide") {
            const t = await openCollideFile(r.file).catch((e: unknown) => void fail(e, COLLIDE_OPEN_FAILED));
            if (t) notify({ tone: "success", title: "Collide file opened", description: r.file });
          }
        },
        (e: unknown) => fail(e, "Could not open markup"),
      );
      return;
    }
    openMarkup().then(
      (n) => n && notify({ tone: "success", title: "Markup opened", description: n }),
      (e: unknown) => fail(e, "Could not open markup"),
    );
  }, [openMarkup, openCollideFile, notify, fail]);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // A .collide file picked in a browser (RUN3 T35): read here, unpacked and checked like one from disk.
    if (f && f.name.toLowerCase().endsWith(COLLIDE_EXT)) {
      void f
        .arrayBuffer()
        .then((b) => openCollideBytes(new Uint8Array(b), f.name, null))
        .then(
          () => notify({ tone: "success", title: "Collide file opened", description: f.name }),
          (err: unknown) => fail(err, COLLIDE_OPEN_FAILED),
        );
    } else if (f) void openImage(URL.createObjectURL(f), f.name).catch((err: unknown) => fail(err, "Could not open the image"));
    e.target.value = "";
  };

  // ---------- New snip, Add snip ----------
  // The New snip button and the global hotkey (the shell sends a snip request) both run the same flow.
  const openSnipRef = useRef(openSnip);
  openSnipRef.current = openSnip;
  const snipRef = useRef<Pick<ReturnType<typeof createSnipFlow>, "start" | "isBusy">>({ start: async () => undefined, isBusy: () => false });
  useEffect(() => {
    const flow = createSnipFlow(electronDeps({ openImage: (url, name) => openSnipRef.current(url, name), notify, delayMs: () => live.current.prefs.snipDelay * 1000 }));
    snipRef.current = flow;
    const bridge = window.collide;
    if (!bridge) return;
    const off = bridge.onSnipRequest(() => void flow.start());
    void bridge.settingsStatus().then(
      (s) => {
        const warning = s?.warning;
        if (warning) notify({ tone: "error", title: "Hotkey setting not used", description: warning });
      },
      () => undefined,
    );
    return off;
  }, [notify]);
  const newSnip = useCallback(() => {
    if (snipRef.current.isBusy()) return;
    const d = live.current.prefs.snipDelay;
    showHint(d > 0 ? `Collide hides, waits ${d} s, then captures` : "Drag a box on your screen. Esc cancels.");
    void snipRef.current.start();
  }, [showHint]);
  /** Add a captured or pasted image to the snip in front (T33). Resolves with the image's size, or null when no snip is in front. */
  const addToSnip = useCallback(
    async (url: string, tabId: string | null) => {
      const front = activeTab(live.current.tabs);
      if (!front || front.kind !== "snip" || (tabId !== null && front.id !== tabId) || !editor.current) return null;
      return editor.current.addImage(url);
    },
    [],
  );
  const addSnip = useCallback(() => {
    // Add snip adds a capture to the open canvas (RUN3 T33, Grant 2026-11-15). With no snip in front it is New snip.
    const front = activeTab(live.current.tabs);
    if (front?.kind !== "snip") return newSnip();
    const behind = live.current.prefs.addMode === "Behind";
    const failed = (e: unknown) => fail(e, "Add snip failed");
    // Added, then the canvas goes to the clipboard, as the prototype says (RUN3 T35).
    const added = (what: string) => async (r: unknown) => {
      if (!r) return;
      let copied = "copied to clipboard";
      try {
        await editor.current?.copyQuiet();
      } catch {
        copied = "not copied: the clipboard refused it";
      }
      showHint(`${what} added beside the image · ${copied}`);
    };
    const bridge = window.collide;
    if (bridge) {
      if (behind) {
        // Behind: Collide hides and you snip the screen behind it, like New snip; the crop comes to this canvas.
        if (snipRef.current.isBusy()) return;
        showHint("Collide hides, then drag a box on the screen behind it. Esc cancels.");
        void snipRef.current.start((url) => addToSnip(url, front.id).then(added("Snip from behind"), failed));
      } else {
        // Current: a new screenshot of the program that is open (the screen as it is, Collide not hidden).
        void bridge
          .captureMonitor()
          .then((cap) => addToSnip(cap.png, front.id))
          .then(added("Screenshot"), failed);
      }
      return;
    }
    // A browser has no screen capture. The sample (dev and test only) adds a sample picture, as the prototype does.
    const art = wantsSample() ? sampleSnip(behind ? "s-pid" : "s-hmi") : undefined;
    const url = art ? sampleArt(art, 1280) : null;
    if (!url) return notify({ tone: "error", title: "Add snip needs the Collide desktop app", description: "Screen capture is not available in a browser. Paste an image (Ctrl+V) to add it beside the image." });
    void addToSnip(url, front.id).then(added(behind ? "Snip from behind" : "Screenshot"), failed);
  }, [addToSnip, fail, newSnip, notify, showHint]);

  // ---------- Paste an image (Ctrl+V) ----------
  // Snip: added beside the image like Add snip. Anything else open, or nothing: a new snip. Text pastes are left alone (RUN3 T33).
  // Markdown: saved to the zip's images/ folder and linked (T34).
  const openImageRef = useRef(openImage);
  openImageRef.current = openImage;
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if (live.current.ask) return;
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      const front = activeTab(live.current.tabs);
      e.preventDefault();
      if (front?.kind === "markdown") {
        // Saved into the zip's images/ folder and linked, like Insert image (RUN3 T34).
        mdEditor.current?.pasteImage(file);
        return;
      }
      const url = URL.createObjectURL(file);
      if (front?.kind === "snip") {
        void addToSnip(url, front.id).then(
          (r) => r && showHint(`Pasted image added beside the image · ${r.width} × ${r.height}`),
          (err: unknown) => fail(err, "Could not paste the image"),
        );
        return;
      }
      const now = new Date();
      void openImageRef.current(url, `Pasted image ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`).then(
        (r) => showHint(`Pasted image opened as a new snip · ${r.width} × ${r.height}`),
        (err: unknown) => fail(err, "Could not paste the image"),
      );
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [addToSnip, fail, showHint]);

  // ---------- Ask first: close, delete ----------
  const askTitle = (a: Ask) => (a.kind === "close" ? (live.current.tabs.tabs.find((t) => t.id === a.tabId)?.title ?? "") : a.item.name);
  const cancelAsk = useCallback(() => setAsk(null), [setAsk]);
  const settingsSave = useRef<(() => void) | null>(null);
  const saveAndClose = useCallback(async () => {
    const a = live.current.ask;
    if (a?.kind !== "close") return;
    const t = live.current.tabs.tabs.find((x) => x.id === a.tabId);
    setAsk(null);
    if (!t) return;
    // Bring it to the front: its editor saves it.
    flushSync(() => setTabs((s) => activateTab(s, t.id)));
    try {
      if (t.kind === "snip") {
        const id = await editor.current?.saveMarkup();
        if (id === undefined) throw new MarkupError("Could not save markup", "The tab's editor is not open. Go to the tab, then save.");
        notify({ tone: "success", title: "Markup saved", description: id });
      } else if (t.kind === "settings") settingsSave.current?.();
      else if (t.kind === "markdown") mdEditor.current?.save();
      dropTab(t.id);
    } catch (e) {
      fail(e, "Could not save markup"); // the tab stays, with its changes
    }
  }, [dropTab, fail, notify, setAsk, setTabs]);
  const discardAndClose = useCallback(() => {
    const a = live.current.ask;
    setAsk(null);
    if (a?.kind === "close") dropTab(a.tabId);
  }, [dropTab, setAsk]);
  const doDelete = useCallback(async () => {
    const a = live.current.ask;
    if (a?.kind !== "delete") return;
    setAsk(null);
    const item = a.item;
    try {
      if (item.kind === "snip" && item.source.from === "store") {
        const store = getStore();
        if (!store.remove) throw new MarkupError("Could not delete markup", "This build cannot delete saved markups. Delete the folder in Documents/Collide/Markups.");
        await store.remove(item.source.folder);
      }
    } catch (e) {
      fail(e, "Could not delete markup");
      return;
    }
    // Its tabs close without asking: the user just chose to delete it.
    for (const t of live.current.tabs.tabs.filter((x) => x.owner === item.id)) dropTab(t.id);
    setSamples((s) => s.filter((x) => x.id !== item.id));
    setStored((s) => s.filter((x) => x.id !== item.id));
    notify({ tone: "success", title: `Deleted ${item.name}`, description: "" });
  }, [dropTab, fail, getStore, notify, setAsk]);

  // ---------- Keys ----------
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (live.current.ask) return; // the splash has the keyboard
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const front = live.current.tabs.active;
      if (ctrl && !e.altKey && k === "w" && front) {
        e.preventDefault();
        requestClose(front);
      } else if (e.ctrlKey && e.key === "Tab" && live.current.tabs.tabs.length > 1) {
        e.preventDefault();
        setTabs((s) => cycleTab(s, e.shiftKey ? -1 : 1));
      } else if (ctrl && e.altKey && k === "s") {
        e.preventDefault();
        newSnip();
      } else if (e.key === "Escape") {
        setPop(false);
        setSideOpen(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [newSnip, requestClose, setTabs]);

  // ---------- The test hook ----------
  useEffect(() => {
    const need = (): SnipEditorApi => {
      if (!editor.current) throw new MarkupError("Could not save markup", "No image is open. Open an image, then save.");
      return editor.current;
    };
    const hook: CollideHook = {
      state: () => {
        const { prefs: p, tabs: t, ask: a } = live.current;
        return refState(
          { tabs: t.tabs, active: t.active, theme: p.theme, aura: p.aura, snipDelay: p.snipDelay, addMode: p.addMode, collapsed: p.collapsed, splash: a ? { kind: a.kind, title: askTitle(a) } : null },
          activeTab(t)?.kind === "snip" ? (editor.current?.refInput() ?? null) : null,
          activeTab(t)?.kind === "markdown" ? (mdEditor.current?.refInput() ?? null) : null,
        );
      },
      openImage: (url, name) => openImage(url, name ?? nameFromUrl(url)),
      openSnip,
      openMarkup,
      seedShape: (s) => need().seedShape(s),
      getDoc: () => editor.current?.getDoc() ?? null,
      getState: () => editor.current?.getState() ?? NO_SNIP,
      screenToImage: (p) => need().screenToImage(p),
      saveMarkup: async () => need().saveMarkup(),
      exportPng: async () => {
        if (!editor.current) throw new Error("Nothing to export: no image is open.");
        return editor.current.exportPng();
      },
      copyFit: async () => {
        if (!editor.current) throw new Error("Nothing to copy: no image is open.");
        return editor.current.copyFit();
      },
    };
    window.__collide = hook;
    return () => {
      delete window.__collide;
    };
  }, [openImage, openSnip, openMarkup]);

  // ---------- Render ----------
  const front = activeTab(tabs);
  // RUN3 T36: Settings → Storage reads the folder's numbers afresh each time it comes to the front.
  const settingsInFront = front?.kind === "settings" ? front.id : null;
  useEffect(() => {
    const storage = window.collide?.storage;
    if (!settingsInFront || !storage) return;
    let alive = true;
    storage.info().then(
      (info) => alive && setStorageInfo(info),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [settingsInFront]);
  const collapse = useCallback(() => setPref("collapsed", !live.current.prefs.collapsed), [setPref]);
  const headBase = front && {
    kind: front.kind,
    dirty: front.dirty,
    collapsed: prefs.collapsed,
    onCollapse: collapse,
    onClose: () => requestClose(front.id),
    onMenu: () => setSideOpen((o) => !o),
  };
  const session = front ? sessions.current.get(front.id) : undefined;
  const file = front ? files.current.get(front.id) : undefined;
  const md = front ? mdSessions.current.get(front.id) : undefined;
  const mdZip = md ? samples.find((z): z is RecentZip => z.kind === "zip" && z.id === md.zipId) : undefined;
  // A link in the page to the zip's picture: one pasted or inserted this session, or a sample's picture.
  const resolve = useMemo<Resolve>(() => {
    const tree = mdZip?.tree;
    return (path) => {
      const f = tree ? zipFile(tree, linkKey(path)) : null;
      if (!f) return null;
      const s = f.sample ? sampleSnip(f.sample) : undefined;
      return f.url ?? (s ? sampleArt(s, 640) : null);
    };
  }, [mdZip]);
  const [password, setPassword] = useState("");

  let body = <Blank onNewSnip={newSnip} onOpenFile={() => fileRef.current?.click()} onMenu={() => setSideOpen((o) => !o)} />;
  if (front && headBase && front.kind === "snip" && session) {
    body = (
      <SnipEditor
        key={front.id}
        session={session}
        pen={pen.current}
        store={getStore}
        apiRef={editor}
        notify={notify}
        themeKey={themeKey}
        onSaveCollide={onSaveCollide}
        onDirty={(d) => setDirty(front.id, d)}
        onSaved={(_, folderName) => {
          // A saved snip is a markup of the store from now on: opening that markup goes to this tab.
          const key = `markup:${folderName}`;
          if (!front.key.startsWith("sample:")) setTabs((s) => patchTab(s, front.id, { key, owner: key }));
          void refreshRecents().then(pruneStorage);
        }}
        head={(save) => (
          <WsHead {...headBase} name={front.title} path={session.source.folder ? `Documents/Collide/Markups/${session.source.folder}` : `${session.image.width} × ${session.image.height} · not saved yet`} savedLabel="Saved" {...save} />
        )}
      />
    );
  } else if (front && headBase && front.kind === "settings") {
    body = (
      <SettingsTab
        key={front.id}
        saved={prefs.settings}
        password={password}
        onPassword={setPassword}
        onDirty={(d) => setDirty(front.id, d)}
        storage={storageInfo}
        onSave={(s) => {
          setPref("settings", s);
          notify({ tone: "success", title: "Saved", description: "" });
          // RUN3 T36: the desktop app's main process keeps the number (empty = off: every file is kept).
          const storage = window.collide?.storage;
          if (storage && s.keep !== (storageInfo?.keep == null ? "" : String(storageInfo.keep))) {
            storage.setKeep(s.keep === "" ? null : Number(s.keep)).then(setStorageInfo, (e: unknown) => fail(e, "Could not save the storage setting"));
          }
        }}
        notify={showHint}
        head={(save) => {
          settingsSave.current = save.onSave;
          return <WsHead {...headBase} name="Settings" path="This computer" savedLabel="Saved" {...save} />;
        }}
      />
    );
  } else if (front && headBase && front.kind === "markdown" && md) {
    const zipId = md.zipId;
    body = (
      <MarkdownEditor
        key={front.id}
        session={md}
        pen={mdPen.current}
        apiRef={mdEditor}
        resolve={resolve}
        addPicture={(url, name) => addPicture(zipId, url, name)}
        pictureNames={() => {
          const z = zipById(zipId);
          return z ? pictureNames(z.tree) : new Set<string>();
        }}
        onDirty={(d) => setDirty(front.id, d)}
        onSave={(text, marks) => saveMdFile(md, text, marks)}
        full={full}
        onFull={() => setFull((f) => !f)}
        hideTools={hideTools}
        onHideTools={() => setHideTools((h) => !h)}
        hint={showHint}
        notify={notify}
        store={getStore}
        onExported={() => void refreshRecents()}
        themeKey={themeKey}
        onSaveCollide={onSaveCollide}
        head={(h) => <WsHead {...headBase} name={md.name} path={md.path} savedLabel="Saved" onSave={h.onSave} canSave={h.canSave} extra={h.extra} tail={h.tail} />}
      />
    );
  } else if (front && headBase && file) {
    body = <FileTab key={front.id} doc={file} kind={front.kind} head={<WsHead {...headBase} name={file.name} path={file.path} />} />;
  }

  const frontFile = front && file ? (front.key.startsWith("doc:") ? front.key.slice(4) : null) : null;
  const cls = ["app", full && front?.kind === "markdown" ? "focus" : "", prefs.collapsed ? "compact" : "", prefs.collapsed && (maximized || hasTab) ? "with-canvas" : "", sideOpen ? "side-open" : ""].filter(Boolean).join(" ");
  const closing = ask?.kind === "close" ? tabs.tabs.find((t) => t.id === ask.tabId) : undefined;
  const deleting = ask?.kind === "delete" ? ask.item : undefined;
  const openTabsOfDeleting = deleting ? tabs.tabs.filter((t) => t.owner === deleting.id).length : 0;

  return (
    <div className={cls} data-testid="app-root" data-frame={isDesktop() ? "native" : "browser"}>
      <Sidebar
        prefs={prefs}
        onDelay={(s) => setPref("snipDelay", s)}
        onAddMode={(m) => setPref("addMode", m)}
        onTheme={(t) => setPref("theme", t)}
        onAura={(a) => setPref("aura", a)}
        onCollapse={collapse}
        onNewSnip={newSnip}
        onAddSnip={addSnip}
        onOpen={onOpen}
        onSettings={openSettings}
        rows={rows}
        query={query}
        onQuery={setQuery}
        openFolders={openFolders}
        onToggleFolder={(id) =>
          setOpenFolders((o) => {
            const n = new Set(o);
            if (!n.delete(id)) n.add(id);
            return n;
          })
        }
        activeOwner={front?.owner ?? null}
        activeFile={frontFile}
        onOpenItem={openItem}
        onOpenFile={openFile}
        onDelete={(item) => setAsk({ kind: "delete", item })}
        pop={pop}
        onPop={setPop}
      />
      <section className="ws" aria-label="Workspace">
        <TabBar tabs={tabs.tabs} active={tabs.active} onActivate={(id) => setTabs((s) => activateTab(s, id))} onClose={requestClose} />
        {body}
      </section>
      <Toasts hint={hint} notice={notice} onDismiss={() => notify(null)} />
      {closing && (
        <Splash
          title={`Save changes to ${closing.title}?`}
          body={`This ${closing.kind === "snip" ? "markup" : closing.kind === "settings" ? "settings" : "file"} has changes that are not saved. If you close without saving, they are lost.`}
          hint="Enter saves · Esc cancels"
          changed
          seed={9}
          themeKey={themeKey}
          onEnter={() => void saveAndClose()}
          onCancel={cancelAsk}
          buttons={[
            { label: "Save and close", variant: "primary", icon: "save", autoFocus: true, onClick: () => void saveAndClose() },
            { label: "Close without saving", onClick: discardAndClose },
            { label: "Cancel", variant: "ghost", onClick: cancelAsk },
          ]}
        />
      )}
      {deleting && (
        <Splash
          title={`Delete ${deleting.name}?`}
          body={`The ${deleting.kind === "snip" ? `markup and its ${deleting.callouts ?? 0} callout${deleting.callouts === 1 ? "" : "s"}` : "zip file and its unpacked folder"} are deleted${
            deleting.kind === "snip" && deleting.source.from === "store" ? " from Documents/Collide/Markups" : ""
          }. This can't be undone.${openTabsOfDeleting ? ` ${openTabsOfDeleting} open tab${openTabsOfDeleting > 1 ? "s close" : " closes"} without saving.` : ""}`}
          hint="Enter deletes · Esc cancels"
          seed={13}
          themeKey={themeKey}
          onEnter={() => void doDelete()}
          onCancel={cancelAsk}
          buttons={[
            { label: "Delete", variant: "danger", icon: "trash-2", onClick: () => void doDelete() },
            { label: "Cancel", variant: "ghost", onClick: cancelAsk },
          ]}
        />
      )}
      <input ref={fileRef} type="file" accept={`image/*,${COLLIDE_EXT}`} hidden data-testid="file-input" onChange={onFile} />
    </div>
  );
}
