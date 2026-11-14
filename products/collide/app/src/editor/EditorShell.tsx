import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { flushSync } from "react-dom";
import type { AnnotationsDoc, Shape } from "../model";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { GlassPanel, Toast } from "../ds";
import { createSnipFlow } from "../snip/flow";
import { isTauri, SNIP_REQUEST_EVENT, tauriDeps } from "../snip/tauriDeps";
import { Canvas, cssVar, type CanvasHandle, type LoadedImage } from "./Canvas";
import { nextShapeId, type NewShape, type ShapePatch } from "./store";
import { DEFAULT_STROKE_WIDTH, TOOL_KEYS, type Tool } from "./tools";
import { useEditorStore } from "./useEditorStore";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { CalloutsPanel } from "./CalloutsPanel";
import { Toolbar } from "./Toolbar";
import { dataUrlToBlob, downloadPng, exportFileName, flatten, type Flattened } from "../io/flatten";
import { createMarkupStore, isPng, MarkupError, markupFolderName, type MarkupStore } from "../io";
import { fitView, screenToImage, type Point, type Size, type View } from "./viewport";

/** Resolve a swatch value ("var(--token)") to the hex string stored in the doc. */
const resolveColor = (c: string) => {
  const m = /^var\((--[\w-]+)\)$/.exec(c);
  return m ? cssVar(m[1]) : c;
};

function loadImage(url: string, name: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve({ el, name, width: el.naturalWidth, height: el.naturalHeight });
    el.onerror = () => reject(new Error(`Could not load image: ${name}`));
    el.src = url;
  });
}

async function toPngBytes(blob: Blob): Promise<Uint8Array> {
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

const nameFromUrl = (url: string) => decodeURIComponent(url.split("?")[0].split("/").pop() || "image");

export interface CollideTestState {
  image: { name: string; width: number; height: number } | null;
  stage: { scale: number; x: number; y: number; width: number; height: number } | null;
  /** Shape data as stored (image pixels). */
  shapes: { id: string; x: number; y: number; w: number; h: number }[];
  /** Shape positions measured from the Konva nodes and converted to image-relative coordinates. */
  shapesOnImage: { id: string; x: number; y: number }[];
  selectedId: string | null;
}

export interface CollideHook {
  /** Load an image from a URL, fit it to the canvas and clear shapes. Resolves with its size. */
  openImage: (url: string, name?: string) => Promise<{ width: number; height: number }>;
  /** Add a test rectangle (image pixels). Returns its id. */
  seedShape: (s?: Partial<Pick<Shape, "x" | "y" | "w" | "h">>) => string;
  getState: () => CollideTestState;
  /** The current annotations doc (image pixels), or null before an image is open. */
  getDoc: () => AnnotationsDoc | null;
  /** Convert a point in canvas-container coordinates to image pixels using the current view. */
  screenToImage: (p: Point) => Point;
  /** Open a saved markup: by folder id, or the picker/most recent when omitted. Resolves with the folder name, or null if cancelled. */
  openMarkup: (folder?: string) => Promise<string | null>;
  /** Save the current markup. Resolves with the folder id. */
  saveMarkup: () => Promise<string>;
  /** Flatten to a PNG at source size (no download). Resolves with the data URL and its size. */
  exportPng: () => Promise<Flattened>;
}

declare global {
  interface Window {
    __collide?: CollideHook;
  }
}

export function EditorShell() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const { state, dispatch, stateRef, canUndo, canRedo } = useEditorStore();
  const shapes = useMemo(() => state.doc?.shapes ?? [], [state.doc]);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColorState] = useState("var(--signal-500)");
  const [strokeWidth, setStrokeWidthState] = useState<number>(DEFAULT_STROKE_WIDTH);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const handleRef = useRef<CanvasHandle | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const live = useRef({ image, view });
  live.current = { image, view };

  const onSize = useCallback((s: Size) => {
    sizeRef.current = s;
  }, []);

  const storeRef = useRef<MarkupStore | null>(null);
  const getStore = () => (storeRef.current ??= createMarkupStore());
  /** Original bytes of the open image (as PNG) and the markup folder it was saved to / opened from. */
  const sourceRef = useRef<{ bytes: Promise<Uint8Array>; folder: string | null } | null>(null);

  const showImage = useCallback((img: LoadedImage, doc?: AnnotationsDoc) => {
    // Commit synchronously so the Konva nodes exist when the promise resolves (test hook relies on it).
    flushSync(() => {
      setImage(img);
      dispatch({ type: "load", width: img.width, height: img.height, doc });
      setView(fitView(sizeRef.current, img));
    });
    live.current = { image: img, view: fitView(sizeRef.current, img) };
    return { width: img.width, height: img.height };
  }, [dispatch]);

  const open = useCallback(async (url: string, name: string) => {
    const img = await loadImage(url, name);
    // Keep the original bytes so source.png is the untouched source image (fetched lazily, awaited on save).
    const bytes = fetch(url).then((r) => r.blob()).then(toPngBytes);
    bytes.catch(() => undefined);
    sourceRef.current = { bytes, folder: null };
    return showImage(img);
  }, [showImage]);

  const exportPng = useCallback(async (): Promise<Flattened> => {
    const { image: img } = live.current;
    const stage = handleRef.current?.stage();
    if (!img || !stage) throw new Error("Nothing to export: no image is open.");
    return flatten(stage, img);
  }, []);

  const [notice, setNotice] = useState<{ tone: "error" | "success"; title: string; description: string } | null>(null);
  const fail = useCallback((e: unknown, fallbackTitle: string) => {
    const title = e instanceof MarkupError ? e.title : fallbackTitle;
    const description = e instanceof Error ? e.message : String(e);
    setNotice({ tone: "error", title, description });
  }, []);

  const saveMarkup = useCallback(async (): Promise<string> => {
    const { image: img } = live.current;
    const doc = stateRef.current.doc;
    const src = sourceRef.current;
    if (!img || !doc || !src) throw new MarkupError("Could not save markup", "No image is open. Open an image, then save.");
    const flat = await exportPng();
    const exportBytes = new Uint8Array(await dataUrlToBlob(flat.dataUrl).arrayBuffer());
    const folderName = src.folder ?? markupFolderName(img.name);
    const id = await getStore().save(folderName, { sourcePng: await src.bytes, annotations: doc, exportPng: exportBytes });
    src.folder = id.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? id;
    return id;
  }, [exportPng, stateRef]);

  const openMarkup = useCallback(async (folder?: string): Promise<string | null> => {
    const store = getStore();
    const id = folder ?? (await store.pick());
    if (!id) return null;
    const m = await store.open(id);
    const blob = new Blob([m.sourcePng as BlobPart], { type: "image/png" });
    const img = await loadImage(URL.createObjectURL(blob), m.folderName);
    if (img.width !== m.annotations.source.width || img.height !== m.annotations.source.height) {
      throw new MarkupError(
        "Could not open markup",
        `source.png is ${img.width}×${img.height} but annotations.json says ${m.annotations.source.width}×${m.annotations.source.height}. Restore the matching source.png or re-save the markup.`,
      );
    }
    sourceRef.current = { bytes: Promise.resolve(m.sourcePng), folder: m.folderName };
    showImage(img, m.annotations);
    return m.folderName;
  }, [showImage]);

  const onSave = useCallback(() => {
    setNotice(null);
    saveMarkup().then(
      (id) => setNotice({ tone: "success", title: "Markup saved", description: id }),
      (e: unknown) => fail(e, "Could not save markup"),
    );
  }, [saveMarkup, fail]);
  const onOpenMarkup = useCallback(() => {
    setNotice(null);
    openMarkup().then(
      (n) => n && setNotice({ tone: "success", title: "Markup opened", description: n }),
      (e: unknown) => fail(e, "Could not open markup"),
    );
  }, [openMarkup, fail]);

  const [exportError, setExportError] = useState(false);
  const onExport = useCallback(() => {
    setExportError(false);
    void exportPng().then(
      (f) => downloadPng(f.dataUrl, exportFileName(live.current.image?.name ?? "image")),
      () => setExportError(true),
    );
  }, [exportPng]);

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
  }, [dispatch, onSave]);

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
        dispatch({ type: "select", id: null });
        return;
      }
      const next = TOOL_KEYS[e.key.toLowerCase()];
      if (next) setTool(next);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dispatch, stateRef]);

  // T11: New snip button and the global hotkey (Rust emits SNIP_REQUEST_EVENT) both run the same flow.
  const snipRef = useRef<ReturnType<typeof createSnipFlow>>({ start: async () => undefined, isBusy: () => false });
  useEffect(() => {
    const flow = createSnipFlow(tauriDeps({ openImage: (url, name) => open(url, name), notify: setNotice }));
    snipRef.current = flow;
    if (!isTauri()) return;
    const un = listen(SNIP_REQUEST_EVENT, () => void flow.start());
    void invoke("get_settings_status").then((s) => {
      const warning = (s as { warning?: string | null } | null)?.warning;
      if (warning) setNotice({ tone: "error", title: "Hotkey setting not used", description: warning });
    }, () => undefined);
    return () => void un.then((f) => f());
  }, [open]);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void open(URL.createObjectURL(f), f.name);
    e.target.value = "";
  };

  useEffect(() => {
    const hook: CollideHook = {
      openImage: (url, name) => open(url, name ?? nameFromUrl(url)),
      seedShape: (s) => {
        const id = nextShapeId(stateRef.current.doc?.shapes ?? []);
        flushSync(() => dispatch({
          type: "add",
          shape: {
            type: "rect",
            x: s?.x ?? 100,
            y: s?.y ?? 80,
            w: s?.w ?? 120,
            h: s?.h ?? 60,
            stroke: cssVar("--signal-500"),
            strokeWidth: 2,
          },
        }));
        return id;
      },
      getDoc: () => stateRef.current.doc,
      exportPng,
      openMarkup,
      saveMarkup,
      screenToImage: (p) => screenToImage(live.current.view, p),
      getState: () => {
        const { image: img } = live.current;
        const ss = stateRef.current.doc?.shapes ?? [];
        const stage = handleRef.current?.stage() ?? null;
        const bg = stage?.findOne(".background") ?? null;
        const inv = bg?.getAbsoluteTransform().copy().invert();
        return {
          selectedId: stateRef.current.selectedId,
          image: img && { name: img.name, width: img.width, height: img.height },
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
    window.__collide = hook;
    return () => {
      delete window.__collide;
    };
  }, [open, dispatch, stateRef, exportPng, openMarkup, saveMarkup]);

  return (
    <div
      style={{
        height: "100vh",
        padding: 14,
        boxSizing: "border-box",
        background: "var(--grain), var(--ambient-ember), var(--bg-canvas)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <GlassPanel radius="xl" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ height: 38, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", borderBottom: "1px solid var(--line-1)" }}>
          <span style={{ font: "600 15px/1 var(--font-sans)", letterSpacing: "-0.04em" }}>Collide</span>
          <span style={{ font: "500 10.5px/1 var(--font-mono)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-4)" }}>
            Snip &amp; Markup
          </span>
        </div>
        <Toolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          fileName={image?.name ?? "No image"}
          onOpenFile={() => fileRef.current?.click()}
          onNewSnip={() => void snipRef.current.start()}
          onExport={onExport}
          canExport={!!image}
          onSave={onSave}
          onOpenMarkup={onOpenMarkup}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <Sidebar current={image && { name: image.name, meta: `${image.width} × ${image.height}` }} />
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
            handleRef={handleRef}
          />
          <CalloutsPanel shapes={shapes} selectedId={state.selectedId} onSelect={onSelect} onNote={onNote} onCommit={onCommit} />
        </div>
        <StatusBar zoom={view.scale} dims={image && { width: image.width, height: image.height }} />
      </GlassPanel>
      {exportError && (
        <div style={{ position: "fixed", right: 28, bottom: 52, zIndex: 10 }} data-testid="export-error">
          <Toast
            tone="error"
            title="Export failed"
            description="The image could not be drawn. Try again or reopen the image."
            onClose={() => setExportError(false)}
          />
        </div>
      )}
      {notice && (
        <div style={{ position: "fixed", right: 28, bottom: 100, zIndex: 10 }} data-testid="notice">
          <Toast tone={notice.tone} title={notice.title} description={notice.description} onClose={() => setNotice(null)} />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden data-testid="file-input" onChange={onFile} />
    </div>
  );
}
