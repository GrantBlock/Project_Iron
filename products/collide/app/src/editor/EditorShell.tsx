import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { flushSync } from "react-dom";
import type { AnnotationsDoc, Shape } from "../model";
import { Canvas, cssVar, type CanvasHandle, type LoadedImage } from "./Canvas";
import { historyReducer, initialHistory, type HistoryState } from "./history";
import { nextShapeId, type NewShape, type ShapePatch } from "./store";
import { DEFAULT_STROKE_WIDTH, TOOL_KEYS, type Tool } from "./tools";
import { useEditorStore } from "./useEditorStore";
import { StatusBar } from "./StatusBar";
import { CalloutsPanel } from "./CalloutsPanel";
import { Toolbar } from "./Toolbar";
import { copyPngToClipboard, dataUrlToBlob, downloadPng, exportFileName, flatten, flattenArea, flattenFit, type Flattened } from "../io/flatten";
import { isPng, MarkupError, markupFolderName, type MarkupStore } from "../io";
import { snipName } from "../snip/flow";
import { fitView, recentre, screenToImage, type Point, type Size, type View } from "./viewport";
import type { RefInput } from "./refState";

// The Snip editor (canvas, tools, callouts) as it lives inside a Snip tab (RUN3 T31).
// Everything a tab must keep while another tab is in front is in its `SnipSession`, which the shell owns:
// the image, the document with its undo history, the view and where it is saved. Only the tab in front
// has an editor on screen; switching tabs mounts the editor again from the session.

/** Resolve a swatch value ("var(--token)") to the hex string stored in the doc. */
const resolveColor = (c: string) => {
  const m = /^var\((--[\w-]+)\)$/.exec(c);
  return m ? cssVar(m[1]) : c;
};

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
}

/** A session for an image: a new empty document, or `doc` (a saved markup or a sample, counted as saved). */
export function createSnipSession(image: LoadedImage, bytes: Promise<Uint8Array>, opened?: { doc: AnnotationsDoc; folder: string | null }): SnipSession {
  bytes.catch(() => undefined); // awaited on save; a failure is reported there
  const history = historyReducer(initialHistory, { type: "load", width: image.width, height: image.height, doc: opened?.doc });
  return { image, history, view: null, fitted: true, source: { bytes, folder: opened?.folder ?? null }, baseDoc: opened ? history.present.doc : null };
}

/** The tool, colour and line thickness: one set for every Snip tab. */
export interface Pen {
  tool: Tool;
  color: string;
  strokeWidth: number;
}
export const defaultPen = (): Pen => ({ tool: "select", color: "var(--signal-500)", strokeWidth: DEFAULT_STROKE_WIDTH });

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
  /** Canvas snip: open the dragged area as a new markup and copy it. */
  onOpenSnip: (url: string, name: string) => Promise<unknown>;
  /** The tab's header (name, Save, Close), given the editor's Save. */
  head: (save: { onSave: () => void; canSave: boolean }) => ReactNode;
  /** Changes when the theme does, so the canvas repaints with the theme's colours. */
  themeKey: string;
}

export function SnipEditor({ session, pen, store, apiRef, notify, onDirty, onSaved, onOpenSnip, head, themeKey }: Props) {
  const image = session.image;
  const { state, dispatch, stateRef, canUndo, canRedo } = useEditorStore(session.history, (h) => (session.history = h));
  const shapes = useMemo(() => state.doc?.shapes ?? [], [state.doc]);
  const [view, setViewState] = useState<View>(session.view ?? { scale: 1, x: 0, y: 0 });
  // True while the view is "fit to window": resizing refits and recentres. A user zoom/pan clears it; Ctrl+0 sets it again.
  const fittedRef = useRef(session.view ? session.fitted : true);
  const setView = useCallback((update: View | ((v: View) => View)) => {
    fittedRef.current = false;
    setViewState(update);
  }, []);
  const [tool, setToolState] = useState<Tool>(pen.tool === "canvas-snip" ? "select" : pen.tool);
  const [color, setColorState] = useState(pen.color);
  const [strokeWidth, setStrokeWidthState] = useState<number>(pen.strokeWidth);
  const setTool = useCallback((t: Tool | ((t: Tool) => Tool)) => setToolState(t), []);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const handleRef = useRef<CanvasHandle | null>(null);

  // What the hook and the window-level handlers read, as of the last render; the session and the pen follow.
  const live = useRef({ view, tool, color, strokeWidth });
  live.current = { view, tool, color, strokeWidth };
  useEffect(() => {
    session.view = view;
    session.fitted = fittedRef.current;
    pen.tool = tool;
    pen.color = color;
    pen.strokeWidth = strokeWidth;
  });

  // The view a tab had comes back as it was; a fitted view (and a new tab) fits to the canvas.
  const restore = useRef(session.view !== null && !session.fitted);
  const onSize = useCallback(
    (s: Size) => {
      const prev = sizeRef.current;
      if (s.width <= 0 || s.height <= 0 || (prev.width === s.width && prev.height === s.height)) return;
      sizeRef.current = s;
      const first = prev.width === 0 || prev.height === 0;
      if (first && restore.current) return;
      if (fittedRef.current || first) setViewState(fitView(s, image));
      else setViewState((v) => recentre(v, prev, s));
    },
    [image],
  );

  const fitToWindow = useCallback(() => {
    fittedRef.current = true;
    setViewState(fitView(sizeRef.current, image));
  }, [image]);

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
  const saveMarkup = useCallback(async (): Promise<string> => {
    const doc = stateRef.current.doc;
    const src = session.source;
    if (!doc) throw new MarkupError("Could not save markup", "No image is open. Open an image, then save.");
    const flat = await exportPng();
    const exportBytes = new Uint8Array(await dataUrlToBlob(flat.dataUrl).arrayBuffer());
    const folderName = src.folder ?? markupFolderName(image.name);
    const id = await store().save(folderName, { sourcePng: await src.bytes, annotations: doc, exportPng: exportBytes });
    src.folder = id.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? id;
    session.baseDoc = doc;
    dirtyRef.current(stateRef.current.doc !== doc);
    savedRef.current(id, src.folder);
    return id;
  }, [exportPng, image, session, stateRef, store]);

  const onSave = useCallback(() => {
    notify(null);
    saveMarkup().then(
      (id) => notify({ tone: "success", title: "Markup saved", description: id }),
      (e: unknown) => fail(e, "Could not save markup"),
    );
  }, [saveMarkup, fail, notify]);

  const onExport = useCallback(() => {
    notify(null);
    void exportPng().then(
      (f) => downloadPng(f.dataUrl, exportFileName(image.name)),
      () => notify({ tone: "error", title: "Export failed", description: "The image could not be drawn. Try again or reopen the image." }),
    );
  }, [exportPng, image, notify]);

  // Copy: the image plus every annotation (auto-cropped, canvas background outside the image) to the clipboard.
  const copyToClipboard = useCallback(
    (title: string) =>
      copyFit()
        .then((f) => copyPngToClipboard(f.dataUrl))
        .then(
          () => notify({ tone: "success", title, description: "Paste the marked-up image into any app." }),
          (e: unknown) => fail(e, "Copy failed"),
        ),
    [copyFit, fail, notify],
  );
  const onCopy = useCallback(() => void copyToClipboard("Copied to clipboard"), [copyToClipboard]);

  const onAdd = useCallback((shape: NewShape, numbered: boolean) => dispatch({ type: "add", shape, numbered }), [dispatch]);
  const onUpdate = useCallback((id: string, patch: ShapePatch) => dispatch({ type: "update", id, patch }), [dispatch]);
  const onRemove = useCallback((id: string) => dispatch({ type: "remove", id }), [dispatch]);
  const onSelect = useCallback((id: string | null) => dispatch({ type: "select", id }), [dispatch]);

  // Changing colour or stroke width also restyles the selected shape (not callout badges, which stay steel).
  const selectedShape = shapes.find((s) => s.id === state.selectedId);
  const restyle = (patch: ShapePatch) => {
    if (selectedShape && selectedShape.type !== "callout") dispatch({ type: "update", id: selectedShape.id, patch });
  };
  const setColor = (c: string) => {
    setColorState(c);
    restyle({ stroke: resolveColor(c) });
  };
  const setStrokeWidth = (w: number) => {
    setStrokeWidthState(w);
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
        setTool((t) => (t === "canvas-snip" ? "select" : t));
        dispatch({ type: "select", id: null });
        return;
      }
      const next = TOOL_KEYS[e.key.toLowerCase()];
      if (next) setTool(next);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dispatch, stateRef, setTool]);

  // Canvas snip: the dragged area of the canvas (image + markups) becomes a new markup and is copied.
  const onCanvasSnip = useCallback(
    (area: { x: number; y: number; w: number; h: number }) => {
      setTool("select");
      pen.tool = "select";
      const stage = handleRef.current?.stage();
      if (!stage) return;
      let flat: Flattened;
      try {
        flat = flattenArea(stage, { x: area.x, y: area.y, width: area.w, height: area.h }, cssVar("--bg-canvas"));
      } catch (e) {
        fail(e, "Canvas snip failed");
        return;
      }
      void onOpenSnip(flat.dataUrl, snipName(new Date()).replace(/^snip-/, "canvas-snip-")).catch((e: unknown) => fail(e, "Canvas snip failed"));
    },
    [onOpenSnip, fail, pen, setTool],
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
      }),
      seedShape: (s) => {
        const id = nextShapeId(stateRef.current.doc?.shapes ?? []);
        // Commit synchronously so the Konva node exists when this returns (the test hook relies on it).
        flushSync(() =>
          dispatch({
            type: "add",
            shape: { type: "rect", x: s?.x ?? 100, y: s?.y ?? 80, w: s?.w ?? 120, h: s?.h ?? 60, stroke: cssVar("--signal-500"), strokeWidth: 2 },
          }),
        );
        return id;
      },
      getDoc: () => stateRef.current.doc,
      exportPng,
      copyFit,
      copyToClipboard,
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
  }, [apiRef, image, dispatch, stateRef, exportPng, copyFit, copyToClipboard, saveMarkup]);

  return (
    <div className="wsfill" data-theme-key={themeKey}>
      {/* Save stays on for an open snip, changed or not, as before the tabs: saving again writes the same folder (ISSUES 25). */}
      {head({ onSave, canSave: true })}
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        fileName={image.name}
        onCanvasSnip={() => setTool((t) => (t === "canvas-snip" ? "select" : "canvas-snip"))}
        canvasSnipActive={tool === "canvas-snip"}
        onExport={onExport}
        onCopy={onCopy}
        canExport
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
          style={{ stroke: resolveColor(color), strokeWidth }}
          view={view}
          onViewChange={setView}
          onSize={onSize}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onSelect={onSelect}
          onCanvasSnip={onCanvasSnip}
          handleRef={handleRef}
        />
        <CalloutsPanel
          shapes={shapes}
          selectedId={state.selectedId}
          onSelect={onSelect}
          onNote={onNote}
          onCommit={onCommit}
          onToggleHide={(id) => dispatch({ type: "update", id, patch: { hideNumber: !shapes.find((s) => s.id === id)?.hideNumber } })}
        />
      </div>
      <StatusBar zoom={view.scale} dims={{ width: image.width, height: image.height }} />
    </div>
  );
}
