import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { flushSync } from "react-dom";
import type { AnnotationsDoc, Shape } from "../model";
import { Canvas, cssVar, type CanvasHandle, type LoadedImage } from "./Canvas";
import { historyReducer, initialHistory, type HistoryState } from "./history";
import { nextShapeId, type NewShape, type ShapePatch } from "./store";
import { drawsWithColor, loadPenMemory, savePenMemory, TOOL_KEYS, type Role, type Tool } from "./tools";
import { useEditorStore } from "./useEditorStore";
import { StatusBar } from "./StatusBar";
import { CalloutsPanel } from "./CalloutsPanel";
import { Toolbar } from "./Toolbar";
import { copyPngToClipboard, dataUrlToBlob, flatten, flattenArea, flattenFit, type Flattened } from "../io/flatten";
import { saveAsFormats, saveAsName, savePicture, type SaveFormat } from "../io/saveAs";
import { cropImage, placeBeside, printArea, sourceCrop } from "./engine";
import { CropDialog, type CropBox } from "./CropDialog";
import { isPng, MarkupError, markupFolderName, type ImageFile, type MarkupStore } from "../io";
import type { SnipPackage } from "../io/collideFile";
import { fitArea, recentre, screenToImage, type Point, type Size, type View } from "./viewport";
import type { RefInput } from "./refState";
import { isFitKey } from "./fitKey";

// The Snip editor (canvas, tools, callouts) as it lives inside a Snip tab (RUN3 T31).
// Everything a tab must keep while another tab is in front is in its `SnipSession`, which the shell owns:
// the image, the document with its undo history, the view and where it is saved. Only the tab in front
// has an editor on screen; switching tabs mounts the editor again from the session.


export function loadImage(url: string, name: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve({ el, name, width: el.naturalWidth, height: el.naturalHeight });
    el.onerror = () => reject(new Error(`Could not load image: ${name}`));
    el.src = url;
  });
}

export async function toPngBytes(blob: Blob): Promise<Uint8Array> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (isPng(bytes)) return bytes;
  // Other formats (jpeg, webp): re-encode so source.png is really a PNG of the same pixels.
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  const out = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!out) throw new Error("PNG encoding failed");
  return new Uint8Array(await out.arrayBuffer());
}

/** An added image's picture and its PNG bytes (RUN3 T33), by file name (`image-<n>.png`). */
export interface Picture {
  el: HTMLImageElement;
  png: Uint8Array;
}

/** Load added images' files (as opened from a markup folder) into pictures. A file that cannot be decoded is left out. */
export async function loadPictures(files: readonly ImageFile[]): Promise<Map<string, Picture>> {
  const out = new Map<string, Picture>();
  for (const f of files) {
    const url = URL.createObjectURL(new Blob([f.png as BlobPart], { type: "image/png" }));
    try {
      out.set(f.name, { el: (await loadImage(url, f.name)).el, png: f.png });
    } catch {
      /* the item stays, drawn as an empty frame */
    }
  }
  return out;
}

/** T46: the Crop dialog's key for the first snip ("image 1"); shape ids are `a<n>`. */
const SOURCE_CROP = ":source";

/** The next free added-image file name. */
export function nextImageFile(taken: Iterable<string>): string {
  let max = 0;
  for (const n of taken) {
    const m = /^image-(\d+)\.png$/.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `image-${max + 1}.png`;
}

/** What one Snip tab keeps. The editor reads it when it mounts and writes every change back. */
export interface SnipSession {
  image: LoadedImage;
  /** The document, the selection and the undo steps. */
  history: HistoryState;
  /** Zoom and pan; null until the editor has fitted the image once. */
  view: View | null;
  /** True while the view is "fit to window". */
  fitted: boolean;
  /** Original bytes of the image (as PNG) and the markup folder it was saved to / opened from. */
  source: { bytes: Promise<Uint8Array>; folder: string | null };
  /** The document as last saved or opened. Null = never saved, so the tab has unsaved changes from the start. */
  baseDoc: AnnotationsDoc | null;
  /** Added images' pictures by file name (RUN3 T33). Kept for undo and redo; Save writes the ones still on the canvas. */
  pictures: Map<string, Picture>;
  /** RUN3 T35: the Collide file this tab was saved as or opened from (its path, or its name in a browser). */
  collideFile?: string;
}

/** A session for an image: a new empty document, or `doc` (a saved markup or a sample, counted as saved). */
export function createSnipSession(
  image: LoadedImage,
  bytes: Promise<Uint8Array>,
  opened?: { doc: AnnotationsDoc; folder: string | null; pictures?: Map<string, Picture> },
): SnipSession {
  bytes.catch(() => undefined); // awaited on save; a failure is reported there
  const history = historyReducer(initialHistory, { type: "load", width: image.width, height: image.height, doc: opened?.doc });
  return { image, history, view: null, fitted: true, source: { bytes, folder: opened?.folder ?? null }, baseDoc: opened ? history.present.doc : null, pictures: opened?.pictures ?? new Map() };
}

/**
 * The tool, colour and line thickness: one set for every Snip tab. `color` is the pressed colour (none after a draw);
 * `lastColor` and the thickness are remembered across reloads (RUN3 T32, Grant 2026-11-15).
 */
export interface Pen {
  tool: Tool;
  color: Role | null;
  lastColor: Role;
  strokeWidth: number;
}
export const defaultPen = (): Pen => {
  const m = loadPenMemory("snip");
  return { tool: "select", color: null, lastColor: m.role, strokeWidth: m.stroke };
};

export interface CollideTestState {
  image: { name: string; width: number; height: number } | null;
  stage: { scale: number; x: number; y: number; width: number; height: number } | null;
  /** Shape data as stored (image pixels). */
  shapes: { id: string; x: number; y: number; w: number; h: number }[];
  /** Shape positions measured from the Konva nodes and converted to image-relative coordinates. */
  shapesOnImage: { id: string; x: number; y: number }[];
  selectedId: string | null;
}

/** What the shell (and through it the test hook) can ask of the editor in front. */
export interface SnipEditorApi {
  refInput: () => RefInput;
  seedShape: (s?: Partial<Pick<Shape, "x" | "y" | "w" | "h">>) => string;
  getState: () => CollideTestState;
  getDoc: () => AnnotationsDoc | null;
  screenToImage: (p: Point) => Point;
  /** Save the markup. Resolves with the folder id. */
  saveMarkup: () => Promise<string>;
  /** Flatten to a PNG at source size (no download). */
  exportPng: () => Promise<Flattened>;
  copyFit: () => Promise<Flattened>;
  /** Copy the image plus every annotation to the clipboard and say so with `title`. */
  copyToClipboard: (title: string) => Promise<void>;
  /**
   * RUN3 T33: add an image (Add snip, paste) beside the content: its own size (T46, 2.1), selected,
   * the view fitted to the grown canvas. One undo step. Resolves with the image's own size.
   */
  addImage: (url: string, crop?: CropBox) => Promise<{ width: number; height: number }>;
  /** RUN3 T35: copy the print area to the clipboard with no toast. Rejects when the clipboard refuses. */
  copyQuiet: () => Promise<void>;
  /** RUN3 T35: everything a .collide file holds: the doc as Save writes it, the source and added images, and Copy's picture. */
  collidePackage: (title: string) => Promise<SnipPackage>;
}

export interface EditorNotice {
  tone: "error" | "success";
  title: string;
  description: string;
}

interface Props {
  session: SnipSession;
  /** Shared by every Snip tab; the editor keeps it up to date. */
  pen: Pen;
  store: () => MarkupStore;
  apiRef: MutableRefObject<SnipEditorApi | null>;
  notify: (n: EditorNotice | null) => void;
  /** The document changed (or was saved): does the tab have unsaved changes now? */
  onDirty: (dirty: boolean) => void;
  /** Saved: the folder id the store gave, and the folder's name. */
  onSaved: (id: string, folderName: string) => void;
  /** The tab's header (name, Save, Close), given the editor's Save, Copy and Save as (T45). */
  head: (save: { onSave: () => void; canSave: boolean; onCopy: () => void; saveAs: { formats: SaveFormat[]; onSave: (f: SaveFormat) => void } }) => ReactNode;
  /** Changes when the theme does, so the canvas repaints with the theme's colours. */
  themeKey: string;
}

export function SnipEditor({ session, pen, store, apiRef, notify, onDirty, onSaved, head, themeKey }: Props) {
  const { state, dispatch, stateRef, canUndo, canRedo } = useEditorStore(session.history, (h) => (session.history = h));
  // T46 (3.4): the first snip as the editor shows it: its crop ("image 1" Crop) is the picture; items are relative to it.
  const sc = state.doc?.source.crop;
  const image = useMemo<LoadedImage>(() => {
    const whole = session.image;
    if (!sc) return whole;
    const c = sourceCrop({ width: whole.width, height: whole.height, crop: sc });
    return { ...whole, width: c.width, height: c.height, crop: c };
  }, [session.image, sc]);
  const shapes = useMemo(() => state.doc?.shapes ?? [], [state.doc]);
  const [view, setViewState] = useState<View>(session.view ?? { scale: 1, x: 0, y: 0 });
  // True while the view is "fit to window": resizing refits and recentres. A user zoom/pan clears it; Ctrl+0 or F (T48) sets it again.
  const fittedRef = useRef(session.view ? session.fitted : true);
  const setView = useCallback((update: View | ((v: View) => View)) => {
    fittedRef.current = false;
    setViewState(update);
  }, []);
  const [tool, setToolState] = useState<Tool>(pen.tool);
  const [color, setColorState] = useState<Role | null>(pen.color);
  const [lastColor, setLastColor] = useState<Role>(pen.lastColor);
  const [strokeWidth, setStrokeWidthState] = useState<number>(pen.strokeWidth);
  const lastColorRef = useRef(lastColor);
  lastColorRef.current = lastColor;
  // Picking a drawing tool with no colour pressed brings back the last colour.
  const setTool = useCallback((t: Tool) => {
    setToolState(t);
    if (drawsWithColor(t)) setColorState((c) => c ?? lastColorRef.current);
  }, []);
  const [focusNote, setFocusNote] = useState<{ id: string; n: number } | null>(null);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const handleRef = useRef<CanvasHandle | null>(null);
  // Added images' pictures for the canvas (RUN3 T33); the session's map only grows, and a new image is a new document.
  // T39: the added image whose Crop is open; T46: SOURCE_CROP for the first snip ("image 1").
  const [cropId, setCropId] = useState<string | null>(null);
  const pictures = useMemo(() => new Map([...session.pictures].map(([k, v]) => [k, v.el])), [session, state.doc]);

  // What the hook and the window-level handlers read, as of the last render; the session and the pen follow.
  const live = useRef({ view, tool, color, strokeWidth });
  live.current = { view, tool, color, strokeWidth };
  useEffect(() => {
    session.view = view;
    session.fitted = fittedRef.current;
    pen.tool = tool;
    pen.color = color;
    pen.lastColor = lastColor;
    pen.strokeWidth = strokeWidth;
  });

  // The print area (image, shapes and shown bubbles, tight margin): Fit and Copy use it.
  const areaNow = useCallback(
    () => printArea(image, stateRef.current.doc?.shapes ?? [], handleRef.current?.notes() ?? new Map()),
    [image, stateRef],
  );

  // The view a tab had comes back as it was; a fitted view (and a new tab) fits to the canvas.
  const restore = useRef(session.view !== null && !session.fitted);
  const onSize = useCallback(
    (s: Size) => {
      const prev = sizeRef.current;
      if (s.width <= 0 || s.height <= 0 || (prev.width === s.width && prev.height === s.height)) return;
      sizeRef.current = s;
      const first = prev.width === 0 || prev.height === 0;
      if (first && restore.current) return;
      if (fittedRef.current || first) setViewState(fitArea(s, areaNow()));
      else setViewState((v) => recentre(v, prev, s));
    },
    [areaNow],
  );

  const fitToWindow = useCallback(() => {
    fittedRef.current = true;
    setViewState(fitArea(sizeRef.current, areaNow()));
  }, [areaNow]);

  // Unsaved changes: the document is not the one last saved or opened.
  const dirty = state.doc !== session.baseDoc;
  const dirtyRef = useRef(onDirty);
  dirtyRef.current = onDirty;
  useEffect(() => {
    dirtyRef.current(dirty);
  }, [dirty]);

  const copyFit = useCallback(async (): Promise<Flattened> => {
    const stage = handleRef.current?.stage();
    if (!stage) throw new Error("Nothing to copy: no image is open.");
    return flattenFit(stage, image, cssVar("--bg-canvas"));
  }, [image]);

  const exportPng = useCallback(async (): Promise<Flattened> => {
    const stage = handleRef.current?.stage();
    if (!stage) throw new Error("Nothing to export: no image is open.");
    return flatten(stage, image);
  }, [image]);

  const fail = useCallback(
    (e: unknown, fallbackTitle: string) => {
      const title = e instanceof MarkupError ? e.title : fallbackTitle;
      const description = e instanceof Error ? e.message : String(e);
      notify({ tone: "error", title, description });
    },
    [notify],
  );

  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;
  /** The document as Save writes it, with the added images still on the canvas (T33) listed, and their files. */
  const withImages = useCallback((doc: AnnotationsDoc) => {
    const used = [...new Set(doc.shapes.flatMap((s) => (s.type === "image" ? [s.src] : [])))];
    const images = used.flatMap((name) => {
      const p = session.pictures.get(name);
      return p ? [{ name, png: p.png, width: p.el.naturalWidth, height: p.el.naturalHeight }] : [];
    });
    const { images: _old, ...plain } = doc;
    void _old;
    const annotations: AnnotationsDoc = images.length ? { ...plain, images: images.map((i) => ({ file: i.name, width: i.width, height: i.height })) } : plain;
    return { annotations, images };
  }, [session]);
  const saveMarkup = useCallback(async (): Promise<string> => {
    const doc = stateRef.current.doc;
    const src = session.source;
    if (!doc) throw new MarkupError("Could not save markup", "No image is open. Open an image, then save.");
    const flat = await exportPng();
    const exportBytes = new Uint8Array(await dataUrlToBlob(flat.dataUrl).arrayBuffer());
    const folderName = src.folder ?? markupFolderName(image.name);
    // Added images (T33): the ones still on the canvas, as files beside source.png, listed in annotations.json.
    const { annotations, images } = withImages(doc);
    const id = await store().save(folderName, {
      sourcePng: await src.bytes,
      annotations,
      exportPng: exportBytes,
      ...(images.length ? { images: images.map((i) => ({ name: i.name, png: i.png })) } : {}),
    });
    src.folder = id.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? id;
    session.baseDoc = doc;
    dirtyRef.current(stateRef.current.doc !== doc);
    savedRef.current(id, src.folder);
    return id;
  }, [exportPng, image, session, stateRef, store, withImages]);

  const onSave = useCallback(() => {
    notify(null);
    saveMarkup().then(
      (id) => notify({ tone: "success", title: "Markup saved", description: id }),
      (e: unknown) => fail(e, "Could not save markup"),
    );
  }, [saveMarkup, fail, notify]);

  // T45 (6.4): Save as PNG, JPEG or PDF: the picture Export gave (source size, ISSUES 24 and 34).
  const onSaveAs = useCallback(
    (f: SaveFormat) => {
      notify(null);
      if (f !== "png" && f !== "jpeg" && f !== "pdf") return;
      void exportPng()
        .then((pic) => savePicture(pic.dataUrl, f, saveAsName(image.name, f)))
        .then(
          (where) => notify({ tone: "success", title: "Saved", description: where }),
          (e: unknown) => fail(e, "Save as failed"),
        );
    },
    [exportPng, fail, image, notify],
  );

  // Copy: the print area (the image, shapes and shown bubbles, tight margin) to the clipboard.
  const copyArea = useCallback(async (): Promise<Flattened> => {
    const stage = handleRef.current?.stage();
    if (!stage) throw new Error("Nothing to copy: no image is open.");
    const a = areaNow();
    return flattenArea(stage, { x: a.x, y: a.y, width: a.w, height: a.h }, cssVar("--bg-canvas"));
  }, [areaNow]);
  const copyToClipboard = useCallback(
    (title: string) =>
      copyArea()
        .then(async (f) => {
          await copyPngToClipboard(f.dataUrl);
          return f;
        })
        .then(
          (f) => notify({ tone: "success", title, description: `${f.width} × ${f.height} with note boxes` }),
          (e: unknown) => fail(e, "Copy failed"),
        ),
    [copyArea, fail, notify],
  );
  const onCopy = useCallback(() => void copyToClipboard("Copied the print area"), [copyToClipboard]);
  const copyQuiet = useCallback(async () => {
    await copyPngToClipboard((await copyArea()).dataUrl);
  }, [copyArea]);

  // RUN3 T35: a .collide file's content: the doc (back to front), the sources as they are, and what Copy gives.
  const collidePackage = useCallback(
    async (title: string): Promise<SnipPackage> => {
      const doc = stateRef.current.doc;
      if (!doc) throw new MarkupError("Could not save the Collide file", "No image is open. Open an image, then save.");
      const { annotations, images } = withImages(doc);
      const preview = new Uint8Array(await dataUrlToBlob((await copyArea()).dataUrl).arrayBuffer());
      return { kind: "snip", title, doc: annotations, source: await session.source.bytes, images: images.map((i) => ({ name: i.name, png: i.png })), preview };
    },
    [copyArea, session, stateRef, withImages],
  );

  // After a draw no colour stays pressed; a new callout's note takes the cursor.
  const onAdd = useCallback(
    (shape: NewShape, numbered: boolean) => {
      const id = nextShapeId(stateRef.current.doc?.shapes ?? []);
      dispatch({ type: "add", shape, numbered });
      setColorState(null);
      if (numbered) setFocusNote((f) => ({ id, n: (f?.n ?? 0) + 1 }));
    },
    [dispatch, stateRef],
  );
  // T45 (6.6): Add border, a rectangle callout on the main image's edge (added images sit beside it and get none).
  const onAddBorder = useCallback(() => {
    setTool("select");
    const { color: c, strokeWidth: w } = live.current;
    onAdd({ type: "rect", x: 0, y: 0, w: image.width, h: image.height, stroke: c ?? lastColorRef.current, strokeWidth: w } as NewShape, true);
  }, [image, onAdd, setTool]);
  const onRemoveMany = useCallback((ids: string[]) => dispatch({ type: "removeMany", ids }), [dispatch]);
  const onPatch = useCallback((id: string, patch: ShapePatch) => dispatch({ type: "update", id, patch }), [dispatch]);
  const onReorder = useCallback((id: string, index: number) => dispatch({ type: "reorder", id, index }), [dispatch]);
  const onUpdate = useCallback((id: string, patch: ShapePatch) => dispatch({ type: "update", id, patch }), [dispatch]);
  const onRemove = useCallback((id: string) => dispatch({ type: "remove", id }), [dispatch]);
  const onSelect = useCallback((id: string | null) => dispatch({ type: "select", id }), [dispatch]);

  // Changing colour or stroke width also restyles the selected shape (not callout badges); both are remembered.
  const selectedShape = shapes.find((s) => s.id === state.selectedId);
  const restyle = (patch: ShapePatch) => {
    if (tool === "select" && selectedShape && selectedShape.type !== "callout") dispatch({ type: "update", id: selectedShape.id, patch });
  };
  const setColor = (c: Role) => {
    setColorState(c);
    setLastColor(c);
    savePenMemory("snip", { role: c, stroke: strokeWidth });
    restyle({ stroke: c });
  };
  const setStrokeWidth = (w: number) => {
    setStrokeWidthState(w);
    savePenMemory("snip", { role: lastColor, stroke: w });
    restyle({ strokeWidth: w });
  };

  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);
  const onNote = useCallback((id: string, note: string) => dispatch({ type: "update", id, patch: { note } }), [dispatch]);
  const onCommit = useCallback(() => dispatch({ type: "commit" }), [dispatch]);

  // Undo / redo shortcuts; inside text fields the browser's own text undo applies.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "0" && !e.shiftKey) {
        e.preventDefault();
        fitToWindow();
        return;
      }
      if (k === "c" && e.shiftKey) {
        e.preventDefault();
        onCopy();
        return;
      }
      if (k === "s" && !e.shiftKey) {
        e.preventDefault();
        onSave();
        return;
      }
      if (k === "z" && !e.shiftKey) dispatch({ type: "undo" });
      else if (k === "y" || (k === "z" && e.shiftKey)) dispatch({ type: "redo" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dispatch, onSave, onCopy, fitToWindow]);

  // Tool hotkeys and Delete/Backspace.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // T48: the plain F key fits, like Ctrl+0 (never while typing: fitKey.ts).
      if (isFitKey(e)) {
        e.preventDefault();
        fitToWindow();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const id = stateRef.current.selectedId;
        if (id) {
          e.preventDefault();
          dispatch({ type: "remove", id });
        }
        return;
      }
      if (e.key === "Escape") {
        setTool("select");
        dispatch({ type: "select", id: null });
        return;
      }
      const next = TOOL_KEYS[e.key.toLowerCase()];
      if (next) setTool(next);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dispatch, stateRef, setTool, fitToWindow]);

  // With a drawing tool on, a press outside the canvas (not on the toolbar) goes back to Select and still lands.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (live.current.tool === "select") return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('[data-testid="canvas"]') || t.closest('[role="toolbar"]')) return;
      setTool("select");
    };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, [setTool]);

  const addImage = useCallback(
    // T39: `crop` (Add snip's drag box) keeps part of the image; the file stays whole so Crop can widen it later.
    async (url: string, crop?: CropBox) => {
      const loaded = await loadImage(url, "image");
      const png = await toPngBytes(await (await fetch(url)).blob());
      const src = nextImageFile([...session.pictures.keys(), ...(stateRef.current.doc?.shapes ?? []).flatMap((s) => (s.type === "image" ? [s.src] : []))]);
      session.pictures.set(src, { el: loaded.el, png });
      const kept = crop ? { width: Math.max(1, Math.round(loaded.width * crop.w)), height: Math.max(1, Math.round(loaded.height * crop.h)) } : loaded;
      const at = placeBeside(image, stateRef.current.doc?.shapes ?? [], kept);
      flushSync(() => {
        setTool("select");
        dispatch({ type: "add", shape: { type: "image", src, ...at, ...(crop ? { crop } : {}), stroke: "gray", strokeWidth: 0 } as NewShape });
      });
      // The canvas grew: fit the view to it (as the prototype does).
      requestAnimationFrame(fitToWindow);
      return { width: kept.width, height: kept.height };
    },
    [dispatch, fitToWindow, image, session, setTool, stateRef],
  );

  // The shell reaches the editor in front through `apiRef`.
  useLayoutEffect(() => {
    const api: SnipEditorApi = {
      refInput: () => ({
        image,
        shapes: stateRef.current.doc?.shapes ?? [],
        selectedId: stateRef.current.selectedId,
        tool: live.current.tool,
        color: live.current.color,
        strokeWidth: live.current.strokeWidth,
        scale: live.current.view.scale,
        fitted: fittedRef.current,
        bubbles: handleRef.current?.notes(),
      }),
      seedShape: (s) => {
        const id = nextShapeId(stateRef.current.doc?.shapes ?? []);
        // Commit synchronously so the Konva node exists when this returns (the test hook relies on it).
        flushSync(() =>
          dispatch({
            type: "add",
            shape: { type: "rect", x: s?.x ?? 100, y: s?.y ?? 80, w: s?.w ?? 120, h: s?.h ?? 60, stroke: "red", strokeWidth: 2 },
          }),
        );
        return id;
      },
      getDoc: () => stateRef.current.doc,
      exportPng,
      copyFit,
      copyToClipboard,
      addImage,
      copyQuiet,
      collidePackage,
      saveMarkup,
      screenToImage: (p) => screenToImage(live.current.view, p),
      getState: () => {
        const ss = stateRef.current.doc?.shapes ?? [];
        const stage = handleRef.current?.stage() ?? null;
        const bg = stage?.findOne(".background") ?? null;
        const inv = bg?.getAbsoluteTransform().copy().invert();
        return {
          selectedId: stateRef.current.selectedId,
          image: { name: image.name, width: image.width, height: image.height },
          stage: stage && { scale: stage.scaleX(), x: stage.x(), y: stage.y(), width: stage.width(), height: stage.height() },
          shapes: ss.map((s) => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h })),
          shapesOnImage: ss.flatMap((s) => {
            const node = stage?.findOne(`#${s.id}`);
            if (!node || !inv) return [];
            const p = inv.point(node.getAbsolutePosition());
            return [{ id: s.id, x: p.x, y: p.y }];
          }),
        };
      },
    };
    apiRef.current = api;
    return () => {
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [apiRef, image, dispatch, stateRef, exportPng, copyFit, copyToClipboard, saveMarkup, addImage, copyQuiet, collidePackage]);

  return (
    <div className="wsfill" data-theme-key={themeKey}>
      {/* Save stays on for an open snip, changed or not, as before the tabs: saving again writes the same folder (ISSUES 25). */}
      {head({ onSave, canSave: true, onCopy, saveAs: { formats: saveAsFormats("snip"), onSave: onSaveAs } })}
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        fileName={image.name}
        onAddBorder={onAddBorder}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <div className="snipbody">
        <Canvas
          image={image}
          shapes={shapes}
          selectedId={state.selectedId}
          tool={tool}
          style={{ stroke: color ?? lastColor, strokeWidth }}
          view={view}
          onViewChange={setView}
          onSize={onSize}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onRemoveMany={onRemoveMany}
          onSelect={onSelect}
          handleRef={handleRef}
          pictures={pictures}
        />
        <CalloutsPanel
          shapes={shapes}
          selectedId={state.selectedId}
          onSelect={onSelect}
          onNote={onNote}
          onCommit={onCommit}
          onPatch={onPatch}
          onReorder={onReorder}
          onRemove={onRemove}
          onCrop={setCropId}
          base={{ cropped: !!sc, onCrop: () => setCropId(SOURCE_CROP) }}
          focus={focusNote}
          onEscape={() => setTool("select")}
        />
      </div>
      <StatusBar zoom={view.scale} dims={{ width: image.width, height: image.height }} />
      {cropId === SOURCE_CROP && (
        <CropDialog
          src={session.image.el.src}
          file={{ width: session.image.width, height: session.image.height }}
          crop={sc}
          onCancel={() => setCropId(null)}
          onApply={(c) => {
            setCropId(null);
            setTool("select");
            dispatch({ type: "cropSource", crop: c });
            // The picture changed size: fit the view to it.
            requestAnimationFrame(fitToWindow);
          }}
        />
      )}
      {(() => {
        const s = cropId ? shapes.find((x) => x.id === cropId) : undefined;
        const el = s?.type === "image" ? session.pictures.get(s.src)?.el : undefined;
        if (!s || s.type !== "image" || !el) return null;
        const file = { width: el.naturalWidth || el.width, height: el.naturalHeight || el.height };
        return (
          <CropDialog
            src={el.src}
            file={file}
            crop={s.crop}
            onCancel={() => setCropId(null)}
            onApply={(c) => {
              setCropId(null);
              const was = s.crop ?? { x: 0, y: 0, w: 1, h: 1 };
              if ((["x", "y", "w", "h"] as const).every((q) => Math.abs(was[q] - c[q]) < 1e-4)) return;
              dispatch({ type: "update", id: s.id, patch: cropImage(s, file, c) });
            }}
          />
        );
      })()}
    </div>
  );
}
