// The PDF editor inside a PDF tab (RUN3 T38, Grant 2026-11-15: the smallest version; a PDF works the same as the
// other formats). Each page is drawn by pdf.js under the T32 markup engine (the Canvas's `underlay`), one page at
// a time, with page arrows in the header (PageUp / PageDown too). The same tools, colours, bubbles, cards and list
// as Snip and the Markdown page. Items are stored per page in PDF points (coords.ts), so they stay on the same
// spot at any zoom. Ctrl + wheel zooms around the cursor, a plain wheel scrolls, Ctrl+0 or F fits.
// Save (and Ctrl+S) is Save as .collide: the original PDF plus every page's items. Export writes a PDF with the
// markup drawn on each page (pdf-lib, exportPdf.ts); Copy PNG gives the page in front with its markup.
// No PDF text editing, forms or OCR.
//
// Everything a tab keeps while another tab is in front is in its `PdfSession`, which the shell owns.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { AnnotationsDoc, Shape } from "../model";
import { Icon } from "../ds";
import { Canvas, cssVar, type CanvasHandle, type LoadedImage } from "../editor/Canvas";
import { CalloutsPanel } from "../editor/CalloutsPanel";
import { Toolbar } from "../editor/Toolbar";
import { historyReducer, initialHistory, type HistoryState } from "../editor/history";
import { nextShapeId, type NewShape, type ShapePatch } from "../editor/store";
import { drawsWithColor, loadPenMemory, savePenMemory, TOOL_KEYS, type Role, type Tool } from "../editor/tools";
import { useEditorStore } from "../editor/useEditorStore";
import { isCallout, printArea } from "../editor/engine";
import { panBy, type Size, type View } from "../editor/viewport";
import type { PdfRefInput } from "../editor/refState";
import type { Pen } from "../editor/EditorShell";
import { copyPngToClipboard, dataUrlToBlob, flattenArea, type Flattened } from "../io/flatten";
import { MarkupError } from "../io";
import { saveAsFormats, saveAsName, savePicture, type SaveFormat } from "../io/saveAs";
import { zoomPage } from "../markdown/page";
import { fitPdfPage } from "./coords";
import { EXPORT_FAILED, exportPdf, pdfExportName, type PdfPaint } from "./exportPdf";
import { drawPage, openPdfDoc, pageSizes, type PageSize } from "./pdfjs";
import { isFitKey } from "../editor/fitKey";
import "../markdown/markdown.css";
import "./pdf.css";

/** The PDF tools: the Snip keys plus B (box) and C (circle), as on the Markdown page. */
const PAGE_KEYS: Record<string, Tool> = { ...TOOL_KEYS, b: "rect", c: "ellipse" };
/** Copy PNG and the .collide preview draw the page at this many pixels per point. */
const COPY_SCALE = 2;
/** The most pixels per point the page is drawn at on screen (A: sharp to 200% on a 2× screen). */
const MAX_QUALITY = 4;

/** One page: its size as shown (points) and its markup with its undo steps. */
export interface PdfPage {
  width: number;
  height: number;
  history: HistoryState;
  baseDoc: AnnotationsDoc | null;
}

/** What one PDF tab keeps. */
export interface PdfSession {
  name: string;
  /** Shown in the header: where the PDF came from. */
  path: string;
  /** The original PDF, byte for byte (Save keeps it; Export draws on a copy). */
  pdf: Uint8Array;
  pages: PdfPage[];
  /** The page in front, from 0. */
  page: number;
  view: View | null;
  fitted: boolean;
  /** The Collide file this tab was saved as or opened from (its path, or its name in a browser). */
  collideFile?: string;
  /** pdf.js's document, opened once per tab. */
  doc?: Promise<PDFDocumentProxy>;
}

const pageDoc = (p: { width: number; height: number }, shapes: readonly Shape[] = []): AnnotationsDoc => ({ version: 1, source: { kind: "image", width: p.width, height: p.height }, shapes: [...shapes] });

export function createPdfSession(o: { name: string; path: string; pdf: Uint8Array; sizes: readonly PageSize[]; shapes?: readonly (readonly Shape[])[]; page?: number }): PdfSession {
  const pages = o.sizes.map((s, i) => {
    const history = historyReducer(initialHistory, { type: "load", width: s.width, height: s.height, doc: pageDoc(s, o.shapes?.[i]) });
    return { width: s.width, height: s.height, history, baseDoc: history.present.doc };
  });
  return { name: o.name, path: o.path, pdf: o.pdf, pages, page: Math.max(0, Math.min(o.page ?? 0, pages.length - 1)), view: null, fitted: true };
}

/** Open a PDF from its bytes: pdf.js reads it and gives each page's size. */
export async function loadPdfSession(o: { name: string; path: string; pdf: Uint8Array; shapes?: readonly (readonly Shape[])[]; page?: number }): Promise<PdfSession> {
  const doc = openPdfDoc(o.pdf);
  const sizes = await pageSizes(await doc);
  if (o.shapes && o.shapes.length !== sizes.length) throw new Error(`The markup has ${o.shapes.length} pages but the PDF has ${sizes.length}. Save it again from Collide.`);
  const s = createPdfSession({ ...o, sizes });
  s.doc = doc;
  return s;
}

/** Any page with changes since the last save. */
export const pdfDirty = (s: PdfSession) => s.pages.some((p) => p.history.present.doc !== p.baseDoc);
const shapesOf = (p: PdfPage): Shape[] => [...(p.history.present.doc?.shapes ?? [])];

/** The PDF editor's own tool, colour and thickness (remembered apart from Snip's and Markdown's). */
export const defaultPdfPen = (): Pen => {
  const m = loadPenMemory("pdf");
  return { tool: "select", color: null, lastColor: m.role, strokeWidth: m.stroke };
};

/** What the shell can ask of the PDF editor in front. */
export interface PdfEditorApi {
  refInput: () => PdfRefInput;
  /** What a .collide file takes: the page in front, every page's items, and a preview (the page in front with its markup). */
  collideContent: () => Promise<{ page: number; pages: { width: number; height: number; shapes: Shape[] }[]; preview: Uint8Array }>;
  /** Saved: every page's markup is the saved state now. */
  markSaved: () => void;
  /** Export's PDF bytes (the shell's test hook reads them; the toolbar's Export writes them). */
  exportBytes: () => Promise<Uint8Array>;
}

interface Props {
  session: PdfSession;
  pen: Pen;
  apiRef: MutableRefObject<PdfEditorApi | null>;
  onDirty: (dirty: boolean) => void;
  full: boolean;
  onFull: () => void;
  hideTools: boolean;
  onHideTools: () => void;
  hint: (text: string) => void;
  notify: (n: { tone: "error" | "success"; title: string; description: string } | null) => void;
  /** The header, given Save, the pages, Copy and Save as (T45). */
  head: (h: { onSave: () => void; canSave: boolean; extra: ReactNode; tail: ReactNode; onCopy: () => void; saveAs: { formats: SaveFormat[]; onSave: (f: SaveFormat) => void } }) => ReactNode;
  themeKey: string;
  /** Save as .collide (the header's Save, Ctrl+S and the toolbar's button). */
  onSaveCollide: () => void;
}

/** The bubble colours for Export, from design-system tokens (a print look on any theme). */
const exportPaint = (): PdfPaint => ({
  box: cssVar("--ink-50"),
  boxLine: cssVar("--ink-300"),
  text: cssVar("--ink-950"),
  badge: cssVar("--steel-500"),
  badgeText: cssVar("--ink-50"),
  ring: cssVar("--ink-950"),
});

/** A browser has no folder to write to: the file is downloaded. */
function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

let blank: HTMLImageElement | null = null;
/** The page is drawn under the canvas, so the canvas's "image" is only its size. */
const blankImage = () => (blank ??= new window.Image());

/** The page drawn by pdf.js, sharp at the zoom it is shown at. */
function PageCanvas({ doc, index, width, height, quality, canvasRef }: { doc: Promise<PDFDocumentProxy>; index: number; width: number; height: number; quality: number; canvasRef: MutableRefObject<HTMLCanvasElement | null> }) {
  const [drawn, setDrawn] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const run = useRef(0);
  useEffect(() => {
    const n = ++run.current;
    const t = window.setTimeout(() => {
      // Drawn off screen, then copied in one go: no half-drawn page, and no two renders on one canvas.
      const off = document.createElement("canvas");
      doc
        .then((d) => drawPage(d, index, off, quality))
        .then(() => {
          const el = canvasRef.current;
          if (n !== run.current || !el) return;
          el.width = off.width;
          el.height = off.height;
          el.getContext("2d")?.drawImage(off, 0, 0);
          setDrawn(quality);
          setFailed(null);
        })
        .catch((e: unknown) => n === run.current && setFailed(e instanceof Error ? e.message : String(e)));
    }, drawn === null ? 0 : 120);
    return () => window.clearTimeout(t);
    // `drawn` only picks the delay (a new quality is drawn after a short pause, the first one at once): not a dependency.
  }, [doc, index, quality, canvasRef]);
  return (
    <div className="pdfpage" style={{ width, height }} data-testid="pdf-page" data-page={index + 1} data-drawn={drawn !== null ? "yes" : "no"}>
      <canvas ref={canvasRef} style={{ width, height }} aria-label={`Page ${index + 1}`} role="img" />
      {failed && <span className="pdffail">{`Page ${index + 1} could not be drawn: ${failed}`}</span>}
    </div>
  );
}

export function PdfEditor(p: Props) {
  const { session } = p;
  const [page, setPageState] = useState(session.page);
  const setPage = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(session.pages.length - 1, n));
      session.page = next;
      setPageState(next);
    },
    [session],
  );
  // One page's editor at a time: its own markup and undo steps; the tool, colour and view carry over.
  return <PdfPageEditor key={page} {...p} index={page} setPage={setPage} />;
}

function PdfPageEditor(p: Props & { index: number; setPage: (n: number) => void }) {
  const { session, pen, apiRef, onDirty, full, hideTools, themeKey, index, setPage } = p;
  const pageState = session.pages[index];
  const count = session.pages.length;
  const { state, dispatch, stateRef, canUndo, canRedo } = useEditorStore(pageState.history, (h) => (pageState.history = h));
  const shapes = useMemo(() => state.doc?.shapes ?? [], [state.doc]);
  session.doc ??= openPdfDoc(session.pdf);
  const doc = session.doc;

  // ---------- Tool, colour, thickness ----------
  const [tool, setToolState] = useState<Tool>(pen.tool);
  const [color, setColorState] = useState<Role | null>(pen.color);
  const [lastColor, setLastColor] = useState<Role>(pen.lastColor);
  const [strokeWidth, setStrokeWidthState] = useState(pen.strokeWidth);
  const lastColorRef = useRef(lastColor);
  lastColorRef.current = lastColor;
  const setTool = useCallback((t: Tool) => {
    setToolState(t);
    if (drawsWithColor(t)) setColorState((c) => c ?? lastColorRef.current);
  }, []);

  // ---------- Page and view ----------
  const pageImage = useMemo<LoadedImage>(() => ({ el: blankImage(), name: session.name, width: pageState.width, height: pageState.height }), [session.name, pageState]);
  const [view, setViewState] = useState<View>(session.view ?? { scale: 1, x: 0, y: 0 });
  const fittedRef = useRef(session.fitted);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const handleRef = useRef<CanvasHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const onSize = useCallback(
    (s: Size) => {
      const prev = sizeRef.current;
      if (s.width <= 0 || s.height <= 0 || (prev.width === s.width && prev.height === s.height)) return;
      sizeRef.current = s;
      // Fit follows the pane (and each page's own size); a zoom the user chose stays as it was.
      if (fittedRef.current || session.view === null) setViewState(fitPdfPage(s, pageState));
    },
    [pageState, session],
  );
  const fit = useCallback(() => {
    fittedRef.current = true;
    if (sizeRef.current.width > 0) setViewState(fitPdfPage(sizeRef.current, pageState));
  }, [pageState]);
  const zoomBy = useCallback((steps: number, at?: { x: number; y: number }) => {
    fittedRef.current = false;
    const s = sizeRef.current;
    setViewState((v) => zoomPage(v, at ?? { x: s.width / 2, y: s.height / 2 }, steps));
  }, []);
  const onWheelAt = useCallback(
    (e: WheelEvent, cursor: { x: number; y: number }) => {
      if (e.ctrlKey || e.metaKey) return zoomBy(-e.deltaY / 100, cursor);
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      const dy = e.shiftKey ? 0 : e.deltaY;
      setViewState((v) => panBy(v, -dx, -dy));
    },
    [zoomBy],
  );
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const quality = Math.min(MAX_QUALITY, Math.max(1, Math.ceil(view.scale * dpr * 2) / 2));

  // ---------- Unsaved changes (any page) ----------
  const dirtyRef = useRef(onDirty);
  dirtyRef.current = onDirty;
  const [savedTick, setSavedTick] = useState(0);
  useEffect(() => {
    dirtyRef.current(pdfDirty(session));
  }, [state.doc, session, savedTick]);

  const pRef = useRef(p);
  pRef.current = p;

  // ---------- The markup ----------
  const [focusNote, setFocusNote] = useState<{ id: string; n: number } | null>(null);
  const onAdd = useCallback(
    (shape: NewShape, numbered: boolean) => {
      const id = nextShapeId(stateRef.current.doc?.shapes ?? []);
      dispatch({ type: "add", shape, numbered });
      setColorState(null);
      if (numbered) setFocusNote((f) => ({ id, n: (f?.n ?? 0) + 1 }));
    },
    [dispatch, stateRef],
  );
  const onUpdate = useCallback((id: string, patch: ShapePatch) => dispatch({ type: "update", id, patch }), [dispatch]);
  const onRemove = useCallback((id: string) => dispatch({ type: "remove", id }), [dispatch]);
  const onRemoveMany = useCallback((ids: string[]) => dispatch({ type: "removeMany", ids }), [dispatch]);
  const onReorder = useCallback((id: string, i: number) => dispatch({ type: "reorder", id, index: i }), [dispatch]);
  const onSelect = useCallback((id: string | null) => dispatch({ type: "select", id }), [dispatch]);
  const onNote = useCallback((id: string, note: string) => dispatch({ type: "update", id, patch: { note } }), [dispatch]);
  const onCommit = useCallback(() => dispatch({ type: "commit" }), [dispatch]);
  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);

  const selectedShape = shapes.find((s) => s.id === state.selectedId);
  const restyle = (patch: ShapePatch) => {
    if (tool === "select" && selectedShape) dispatch({ type: "update", id: selectedShape.id, patch });
  };
  const setColor = (c: Role) => {
    setColorState(c);
    setLastColor(c);
    savePenMemory("pdf", { role: c, stroke: strokeWidth });
    restyle({ stroke: c });
  };
  const setStrokeWidth = (w: number) => {
    setStrokeWidthState(w);
    savePenMemory("pdf", { role: lastColor, stroke: w });
    restyle({ strokeWidth: w });
  };

  // ---------- Copy PNG: the page in front with its markup ----------
  const renderPage = useCallback(async (): Promise<Flattened> => {
    const stage = handleRef.current?.stage();
    if (!stage) throw new Error("The page is not on screen yet. Try again.");
    const under = document.createElement("canvas");
    await drawPage(await doc, index, under, COPY_SCALE);
    const area = printArea(pageImage, stateRef.current.doc?.shapes ?? [], handleRef.current?.notes() ?? new Map());
    return flattenArea(stage, { x: area.x, y: area.y, width: area.w, height: area.h }, cssVar("--bg-canvas"), { under: { image: under, width: pageImage.width, height: pageImage.height }, pixelRatio: COPY_SCALE });
  }, [doc, index, pageImage, stateRef]);

  const onCopy = useCallback(() => {
    pRef.current.notify(null);
    void renderPage()
      .then(async (f) => {
        await copyPngToClipboard(f.dataUrl);
        pRef.current.hint(`Copied page ${index + 1} and its callouts as a PNG · ${f.width} × ${f.height}`);
      })
      .catch((e: unknown) => pRef.current.notify({ tone: "error", title: "Copy failed", description: e instanceof Error ? e.message : String(e) }));
  }, [index, renderPage]);

  // ---------- Export: a PDF with the markup drawn on each page ----------
  const exportBytes = useCallback(() => exportPdf(session.pdf, session.pages.map(shapesOf), exportPaint()), [session]);
  const onExport = useCallback(() => {
    const q = pRef.current;
    q.notify(null);
    void (async () => {
      const bytes = await exportBytes();
      const name = pdfExportName(session.name);
      const marked = session.pages.filter((pg) => shapesOf(pg).length > 0).length;
      const what = `${count} page${count === 1 ? "" : "s"}, markup on ${marked}`;
      const files = window.collide?.collideFiles;
      if (files) {
        let saved: string;
        try {
          saved = await files.exportPdf(name, bytes);
        } catch (e) {
          throw new MarkupError(EXPORT_FAILED, e instanceof Error ? e.message : String(e));
        }
        q.hint(`Exported ${saved.split(/[\\/]/).pop()} · ${what} · Documents/Collide/Markups/`);
      } else {
        download(bytes, name, "application/pdf");
        q.hint(`Exported ${name} · ${what} · downloaded`);
      }
    })().catch((e: unknown) => q.notify({ tone: "error", title: e instanceof MarkupError ? e.title : EXPORT_FAILED, description: e instanceof Error ? e.message : String(e) }));
  }, [count, exportBytes, session]);

  // T45 (6.4): Save as PDF is the export above (the smallest one, ISSUES 43 stays open); PNG and JPEG are what Copy gives.
  // (A) This tab shows one page at a time (T38), so the page nearest the centre of the view (6.3) is the page in front.
  const onSaveAs = useCallback(
    (f: SaveFormat) => {
      if (f === "pdf") return onExport();
      if (f !== "png" && f !== "jpeg") return;
      const q = pRef.current;
      q.notify(null);
      renderPage()
        .then((pic) => savePicture(pic.dataUrl, f, saveAsName(session.name, f)))
        .then(
          (where) => q.hint(`Saved page ${index + 1} · ${where}`),
          (e: unknown) => q.notify({ tone: "error", title: "Save as failed", description: e instanceof Error ? e.message : String(e) }),
        );
    },
    [index, onExport, renderPage, session],
  );
  // T45 (6.6, A): on a PDF the main image is the page in front: Add border puts a rectangle callout on its edge.
  const onAddBorder = useCallback(() => {
    setTool("select");
    const { color: c, strokeWidth: w } = live.current;
    onAdd({ type: "rect", x: 0, y: 0, w: pageImage.width, h: pageImage.height, stroke: c ?? lastColorRef.current, strokeWidth: w } as NewShape, true);
  }, [onAdd, pageImage, setTool]);

  // ---------- Save as .collide ----------
  const collideContent = useCallback(async () => {
    let preview: Uint8Array;
    try {
      preview = new Uint8Array(await dataUrlToBlob((await renderPage()).dataUrl).arrayBuffer());
    } catch {
      preview = new Uint8Array(await dataUrlToBlob(handleRef.current?.stage()?.toDataURL({ pixelRatio: 0.25 }) ?? "data:image/png;base64,").arrayBuffer());
    }
    return { page: index, pages: session.pages.map((pg) => ({ width: pg.width, height: pg.height, shapes: shapesOf(pg) })), preview };
  }, [index, renderPage, session]);
  const markSaved = useCallback(() => {
    for (const pg of session.pages) pg.baseDoc = pg.history.present.doc;
    setSavedTick((n) => n + 1);
  }, [session]);
  const save = useCallback(() => pRef.current.onSaveCollide(), []);

  // ---------- Keys ----------
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && !e.altKey && !e.shiftKey && k === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (isTyping(e.target) || e.altKey) return;
      // T48: the plain F key fits, like Ctrl+0 (never while typing: fitKey.ts).
      if (isFitKey(e)) {
        e.preventDefault();
        fit();
        return;
      }
      if (e.key === "PageDown" || e.key === "PageUp") {
        e.preventDefault();
        setPage(index + (e.key === "PageDown" ? 1 : -1));
        return;
      }
      if (ctrl) {
        if (k === "0") fit();
        else if (k === "=" || k === "+") zoomBy(1);
        else if (k === "-") zoomBy(-1);
        else if (k === "c" && e.shiftKey) onCopy();
        else if (k === "z" && !e.shiftKey) undo();
        else if (k === "y" || (k === "z" && e.shiftKey)) redo();
        else return;
        e.preventDefault();
        return;
      }
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
      const next = PAGE_KEYS[k];
      if (next) setTool(next);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dispatch, fit, index, onCopy, redo, save, setPage, setTool, stateRef, undo, zoomBy]);

  // With a drawing tool on, a press outside the page pane (not on the toolbar) goes back to Select.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (live.current.tool === "select") return;
      const t = e.target;
      if (!(t instanceof Element) || t.closest('[data-testid="canvas"]') || t.closest('[role="toolbar"]')) return;
      setTool("select");
    };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, [setTool]);

  // ---------- The shell's handle ----------
  useLayoutEffect(() => {
    const api: PdfEditorApi = {
      refInput: () => ({
        pageIndex: index,
        pageCount: count,
        shapes: stateRef.current.doc?.shapes ?? [],
        selectedId: stateRef.current.selectedId,
        tool: live.current.tool,
        color: live.current.color,
        strokeWidth: live.current.strokeWidth,
        scale: live.current.view.scale,
        fitted: fittedRef.current,
        bubbles: handleRef.current?.notes(),
      }),
      collideContent,
      markSaved,
      exportBytes,
    };
    apiRef.current = api;
    return () => {
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [apiRef, collideContent, count, exportBytes, index, markSaved, stateRef]);

  // ---------- Render ----------
  const callouts = shapes.filter(isCallout).length;
  const extra = (
    <span className="viewseg pager" role="group" aria-label="Pages">
      <button type="button" aria-label="Previous page" title="Previous page (Page Up)" disabled={index === 0} onClick={() => setPage(index - 1)}>
        <Icon name="chevron-left" size={14} />
      </button>
      <span className="pagenum" aria-live="polite">{`Page ${index + 1} of ${count}`}</span>
      <button type="button" aria-label="Next page" title="Next page (Page Down)" disabled={index >= count - 1} onClick={() => setPage(index + 1)}>
        <Icon name="chevron-right" size={14} />
      </button>
    </span>
  );
  const tail = (
    <>
      <button type="button" className="btn icon" aria-label="Full width" aria-pressed={full} title={full ? "Show the sidebar and callouts" : "Full width: hide the sidebar and callouts"} onClick={p.onFull}>
        <Icon name="maximize" />
      </button>
      <button type="button" className="btn icon" aria-label={hideTools ? "Show the toolbar" : "Hide the toolbar"} aria-pressed={!hideTools} title={hideTools ? "Show the toolbar" : "Hide the toolbar"} onClick={p.onHideTools}>
        <Icon name={hideTools ? "chevron-down" : "chevron-up"} />
      </button>
    </>
  );

  return (
    <div className="wsfill pdfedit" data-theme-key={themeKey}>
      {p.head({ onSave: save, canSave: true, extra, tail, onCopy, saveAs: { formats: saveAsFormats("pdf"), onSave: onSaveAs } })}
      <Toolbar
        label="PDF tools"
        hidden={hideTools}
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        fileName={session.name}
        onAddBorder={onAddBorder}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <div className={`mdbody${!full ? " with-list" : ""}`}>
        <Canvas
          image={pageImage}
          shapes={shapes}
          selectedId={state.selectedId}
          tool={tool}
          style={{ stroke: color ?? lastColor, strokeWidth }}
          view={view}
          onViewChange={setViewState}
          onSize={onSize}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onRemoveMany={onRemoveMany}
          onSelect={onSelect}
          handleRef={handleRef}
          onWheelAt={onWheelAt}
          underlay={<PageCanvas doc={doc} index={index} width={pageState.width} height={pageState.height} quality={quality} canvasRef={canvasRef} />}
        />
        {!full && (
          <CalloutsPanel
            shapes={shapes}
            selectedId={state.selectedId}
            onSelect={onSelect}
            onNote={onNote}
            onCommit={onCommit}
            onPatch={onUpdate}
            onReorder={onReorder}
            onRemove={onRemove}
            focus={focusNote}
            onEscape={() => setTool("select")}
          />
        )}
      </div>
      <div className="statusbar">
        <span>{session.name}</span>
        <span>{`Page ${index + 1} of ${count} · ${Math.round(pageState.width)} × ${Math.round(pageState.height)} pt`}</span>
        <span>{`${callouts} callout${callouts === 1 ? "" : "s"} on this page`}</span>
        <span style={{ marginLeft: "auto" }} title="Ctrl + mouse wheel zooms; Ctrl+0 or F fits">{`${Math.round(view.scale * 100)}%${fittedRef.current ? " · fit" : ""}`}</span>
      </div>
    </div>
  );
}
