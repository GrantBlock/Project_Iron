// The Markdown editor inside a Markdown tab (RUN3 T34), after ../../../layout-prototype.html (renderDocWS).
// T49 (Grant 2026-11-20): one view. The page is a live CodeMirror 6 editor (livePage.ts: the marks stay visible,
// dimmed; headings, bold, code and the rest styled in place) under the T32 markup engine (the same tools, bubbles with
// leaders outside the page, cards and the list; shapes can start in the margin; Ctrl + wheel zooms around the cursor,
// Ctrl+= / Ctrl+− step, Ctrl+0 or F fits). With Select, a press on the page goes to the text unless it is on a
// callout; a drawing tool draws on the page and the text is read-only. The text tools (second toolbar row, cmTools.ts)
// act on the editor's selection. Insert image and paste save the picture into the zip's images/ folder and link it at
// the caret (at the end of the file when the editor never had one). Copy and Save as take the visible page with its
// callouts, the page drawn by markdown-it (render.ts). The colour and thickness are remembered apart from Snip's.
//
// Everything a tab keeps while another tab is in front is in its `MdSession`, which the shell owns.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Compartment, EditorState, StateEffect, type Extension, type TransactionSpec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type { ChangeEvent, MutableRefObject, ReactNode } from "react";
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
import type { Size, View } from "../editor/viewport";
import type { MdRefInput } from "../editor/refState";
import type { Pen } from "../editor/EditorShell";
import { copyPngToClipboard, dataUrlToBlob, flattenArea, type Flattened, type Under } from "../io/flatten";
import { deliver, saveAsFormats, saveAsName, savePicture, type SaveFormat } from "../io/saveAs";
import { fitPage, PAGE_W, scrollPage, zoomPage } from "./page";
import { pagePicture } from "./pagePicture";
import { renderMarkdown, type Resolve } from "./render";
import { imageLink, pastedName } from "./text";
import { boldTool, headingTool, imageLinkTool, labelTool, linkTool, listTool, numListTool, tableTool } from "./cmTools";
import { livePage, resolveFacet } from "./livePage";
import { isFitKey } from "../editor/fitKey";
import "./markdown.css";

/** Markdown tools in Preview: the Snip keys plus B (box) and C (circle), as in the prototype. */
const PAGE_KEYS: Record<string, Tool> = { ...TOOL_KEYS, b: "rect", c: "ellipse" };
/** Page height before the page is measured (page px). */
const START_H = 900;

/** What one Markdown tab keeps. */
export interface MdSession {
  name: string;
  /** Shown in the header: the zip's name and the path inside it. */
  path: string;
  zipId: string;
  zipName: string;
  /** The file's path in the zip's tree (`<zip id>/folder/file`). */
  file: string;
  text: string;
  /** The text as last saved or opened. */
  baseText: string;
  /** T49: the live editor's state (text, selection, undo steps), kept while another tab is in front. */
  cm: EditorState | null;
  /** T49: the editor has had a caret (a picture goes at the caret; before that, at the end of the file). */
  caret: boolean;
  /** The page markup (page pixels), its selection and undo steps. */
  history: HistoryState;
  baseDoc: AnnotationsDoc | null;
  /** Preview's zoom and scroll; null until fitted once. `fitted` = the zoom is Fit. */
  view: View | null;
  fitted: boolean;
  pageH: number;
  /** RUN3 T35: the Collide file this tab was saved as or opened from (its path, or its name in a browser). */
  collideFile?: string;
}

export function createMdSession(o: { name: string; path: string; zipId: string; zipName: string; file: string; text: string; shapes?: readonly Shape[] }): MdSession {
  const doc: AnnotationsDoc = { version: 1, source: { kind: "image", width: PAGE_W, height: START_H }, shapes: [...(o.shapes ?? [])] };
  const history = historyReducer(initialHistory, { type: "load", width: PAGE_W, height: START_H, doc });
  return { ...o, text: o.text, baseText: o.text, cm: null, caret: false, history, baseDoc: history.present.doc, view: null, fitted: true, pageH: START_H };
}

/** The Markdown editor's own tool, colour and thickness (Grant 2026-11-15: remembered per editor). */
export const defaultMdPen = (): Pen => {
  const m = loadPenMemory("markdown");
  return { tool: "select", color: null, lastColor: m.role, strokeWidth: m.stroke };
};

/** What the shell can ask of the Markdown editor in front. */
export interface MdEditorApi {
  refInput: () => MdRefInput;
  /** A pasted picture: saved to images/ and linked at the caret (at the end of the file when the editor never had one). */
  pasteImage: (file: Blob) => void;
  /** Save the text and the markup into the zip (this session). */
  save: () => void;
  /** T49 (A): after Save source, the same as Save without its message: the tab reads Saved. */
  markSaved: () => void;
  /** RUN3 T35: what a .collide file takes from the editor: the text, the page markup (back to front) and a preview picture. */
  collideContent: () => Promise<{ text: string; shapes: Shape[]; preview: Uint8Array }>;
}

/** A 1 × 1 PNG, when the page cannot be drawn (the preview is only a thumbnail). */
async function blankPng(): Promise<Uint8Array> {
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  return new Uint8Array(b ? await b.arrayBuffer() : []);
}

/** A picture as PNG bytes. */
async function pngOf(img: HTMLImageElement): Promise<Uint8Array> {
  const c = document.createElement("canvas");
  c.width = Math.max(1, img.width);
  c.height = Math.max(1, img.height);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!b) throw new Error("PNG encoding failed");
  return new Uint8Array(await b.arrayBuffer());
}

interface Props {
  session: MdSession;
  pen: Pen;
  apiRef: MutableRefObject<MdEditorApi | null>;
  /** Pictures of the zip, by link path. */
  resolve: Resolve;
  /** Put a picture (data URL) into the zip's images/ folder as `name`; returns the link path. */
  addPicture: (dataUrl: string, name: string) => string;
  /** Names already in the zip's images/ folder. */
  pictureNames: () => ReadonlySet<string>;
  onDirty: (dirty: boolean) => void;
  onSave: (text: string, shapes: Shape[]) => void;
  full: boolean;
  onFull: () => void;
  hideTools: boolean;
  onHideTools: () => void;
  /** A short message in the status toast. */
  hint: (text: string) => void;
  notify: (n: { tone: "error" | "success"; title: string; description: string } | null) => void;
  /** The header, given Save, the view switch, Copy and Save as (T45). */
  head: (h: { onSave: () => void; canSave: boolean; extra: ReactNode; tail: ReactNode; onCopy: () => void; saveAs: { formats: SaveFormat[]; onSave: (f: SaveFormat) => void } }) => ReactNode;
  themeKey: string;
}

let blank: HTMLImageElement | null = null;
/** The page is drawn as HTML under the canvas, so the canvas's "image" is only its size. */
const blankImage = () => (blank ??= new window.Image());

const readDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("The picture could not be read."));
    r.readAsDataURL(file);
  });

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

/** A file name for images/: letters, digits, dot, dash and underscore; `.png` when it has no extension. */
export function pictureFileName(name: string, taken: ReadonlySet<string>): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  const dot = clean.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [clean.slice(0, dot), clean.slice(dot)] : [clean, ".png"];
  let n = 1;
  let out = `${stem}${ext}`;
  while (taken.has(out)) out = `${stem}-${++n}${ext}`;
  return out;
}

/** A clipboard event that carries a picture (the shell saves it into images/). */
const hasPicture = (e: ClipboardEvent) => [...(e.clipboardData?.items ?? [])].some((i) => i.kind === "file" && i.type.startsWith("image/"));

/**
 * The markdown-it page of `text` (what Copy and Export draw under the callouts), laid out off screen in `host` so it
 * takes the theme's tokens, then drawn as a picture; it is removed again before this returns.
 */
async function renderedPage(host: HTMLElement, text: string, resolve: Resolve): Promise<{ image: HTMLImageElement; height: number }> {
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.className = "mdoffscreen";
  const el = document.createElement("div");
  el.className = "mdpage";
  el.innerHTML = renderMarkdown(text, resolve);
  box.appendChild(el);
  host.appendChild(box);
  try {
    await Promise.all([...el.querySelectorAll("img")].map((i) => i.decode().catch(() => undefined)));
    return { image: await pagePicture(el), height: el.offsetHeight };
  } finally {
    box.remove();
  }
}

export function MarkdownEditor(p: Props) {
  const { session, pen, apiRef, resolve, onDirty, full, hideTools, themeKey } = p;
  const [text, setTextState] = useState(session.text);
  const setText = useCallback(
    (t: string) => {
      session.text = t;
      setTextState(t);
    },
    [session],
  );
  const { state, dispatch, stateRef, canUndo, canRedo } = useEditorStore(session.history, (h) => (session.history = h));
  const shapes = useMemo(() => state.doc?.shapes ?? [], [state.doc]);

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
  const [pageH, setPageH] = useState(session.pageH);
  const pageImage = useMemo<LoadedImage>(() => ({ el: blankImage(), name: session.name, width: PAGE_W, height: pageH }), [session.name, pageH]);
  const [view, setViewState] = useState<View>(session.view ?? { scale: 1, x: 0, y: 0 });
  const fittedRef = useRef(session.fitted);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const handleRef = useRef<CanvasHandle | null>(null);
  const live = useRef({ view, tool, color, strokeWidth, pageH });
  live.current = { view, tool, color, strokeWidth, pageH };
  useEffect(() => {
    session.view = view;
    session.fitted = fittedRef.current;
    session.pageH = pageH;
    pen.tool = tool;
    pen.color = color;
    pen.lastColor = lastColor;
    pen.strokeWidth = strokeWidth;
  });

  const restore = useRef(session.view !== null);
  const onSize = useCallback((s: Size) => {
    const prev = sizeRef.current;
    if (s.width <= 0 || s.height <= 0 || (prev.width === s.width && prev.height === s.height)) return;
    sizeRef.current = s;
    if (prev.width === 0 && restore.current) {
      restore.current = false;
      return; // the view this tab had comes back as it was
    }
    if (!fittedRef.current && prev.width > 0) return;
    // Fit: the zoom follows the pane; the scroll stays on the same part of the page.
    setViewState((v) => {
      const f = fitPage(s);
      return prev.width > 0 && v.scale > 0 ? { ...f, y: Math.min(f.y, (v.y * f.scale) / v.scale) } : f;
    });
  }, []);
  const fit = useCallback(() => {
    fittedRef.current = true;
    if (sizeRef.current.width > 0) setViewState(fitPage(sizeRef.current));
  }, []);
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
      setViewState((v) => scrollPage(v, sizeRef.current, live.current.pageH, dx, dy));
    },
    [zoomBy],
  );
  // The page's height, as laid out (pictures can change it after they load).
  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setPageH(Math.max(1, el.offsetHeight));
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(() => setPageH(Math.max(1, el.offsetHeight)));
    observer.current.observe(el);
  }, []);

  // ---------- Unsaved changes ----------
  const dirty = text !== session.baseText || state.doc !== session.baseDoc;
  const dirtyRef = useRef(onDirty);
  dirtyRef.current = onDirty;
  useEffect(() => {
    dirtyRef.current(dirty);
  }, [dirty]);

  const pRef = useRef(p);
  pRef.current = p;
  const [, setSavedTick] = useState(0);
  const save = useCallback((quiet = false) => {
    const doc = stateRef.current.doc;
    pRef.current.onSave(session.text, [...(doc?.shapes ?? [])]);
    session.baseText = session.text;
    session.baseDoc = doc;
    dirtyRef.current(false);
    setSavedTick((n) => n + 1); // re-render: the unsaved mark goes
    if (!quiet) pRef.current.notify({ tone: "success", title: "Saved", description: `${session.zipName} · kept until Collide closes (zip files on disk come later)` });
  }, [session, stateRef]);

  // ---------- The live page: one CodeMirror editor ----------
  const cmRef = useRef<EditorView | null>(null);
  const editable = useRef(new Compartment()).current;
  const resolveConf = useRef(new Compartment()).current;
  /** Apply a text tool to the editor's selection: one undo step; the caret goes back into the text. */
  const applyTool = useCallback(
    (fn: (s: EditorState) => TransactionSpec) => {
      const v = cmRef.current;
      if (!v) return;
      v.dispatch(fn(v.state));
      session.caret = true;
      if (live.current.tool === "select") v.focus();
    },
    [session],
  );
  const extensions = useCallback(
    (): Extension[] => [
      history(),
      keymap.of([{ key: "Mod-b", preventDefault: true, run: (v) => (v.dispatch(boldTool(v.state)), true) }, ...defaultKeymap, ...historyKeymap]),
      livePage(),
      editable.of(EditorView.editable.of(live.current.tool === "select")),
      resolveConf.of(resolveFacet.of(pRef.current.resolve)),
      EditorView.contentAttributes.of({ "aria-label": session.name, spellcheck: "false" }),
      // A pasted picture is the shell's (saved into images/ and linked); CodeMirror leaves it alone.
      EditorView.domEventHandlers({ paste: (e) => hasPicture(e) }),
      EditorView.updateListener.of((u) => {
        session.cm = u.state;
        if (u.docChanged) setText(u.state.doc.toString());
        if (u.focusChanged && u.view.hasFocus) session.caret = true;
      }),
    ],
    [editable, resolveConf, session, setText],
  );
  const host = useCallback(
    (el: HTMLDivElement | null) => {
      const old = cmRef.current;
      if (old) {
        session.cm = old.state;
        old.destroy();
        cmRef.current = null;
      }
      if (!el) return;
      const prev = session.cm && session.cm.doc.toString() === session.text ? session.cm : null;
      const exts = extensions();
      const st = prev ? prev.update({ effects: StateEffect.reconfigure.of(exts) }).state : EditorState.create({ doc: session.text, extensions: exts });
      cmRef.current = new EditorView({ state: st, parent: el });
    },
    [extensions, session],
  );
  // A drawing tool draws on the page: the text is read-only until Select is back.
  useEffect(() => {
    const v = cmRef.current;
    if (!v) return;
    v.dispatch({ effects: editable.reconfigure(EditorView.editable.of(tool === "select")) });
    if (tool !== "select") v.contentDOM.blur();
  }, [editable, tool]);
  // The zip's pictures, shown under their links.
  useEffect(() => {
    const v = cmRef.current;
    if (v && v.state.facet(resolveFacet) !== resolve) v.dispatch({ effects: resolveConf.reconfigure(resolveFacet.of(resolve)) });
  }, [resolve, resolveConf]);

  // With Select, the page's text takes the pointer except over a callout (the canvas then has it, to select and move).
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const overShape = useRef(false);
  const routePointer = useCallback(() => {
    const c = handleRef.current?.stage()?.container();
    if (c) c.style.pointerEvents = live.current.tool !== "select" || overShape.current ? "" : "none";
  }, []);
  useEffect(routePointer);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const hit = (e: PointerEvent | WheelEvent) => {
      const stage = handleRef.current?.stage();
      if (!stage || live.current.tool !== "select") return (overShape.current = false);
      const r = stage.container().getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      overShape.current = x >= 0 && y >= 0 && x <= r.width && y <= r.height && !!stage.getIntersection({ x, y });
      routePointer();
      return overShape.current;
    };
    const move = (e: PointerEvent) => {
      if (e.buttons === 0) hit(e); // not while a shape or the text selection is being dragged
    };
    const down = (e: PointerEvent) => {
      if (hit(e)) return;
      // A press in the text with Select: no callout is selected any more.
      if (live.current.tool === "select" && e.target instanceof Element && e.target.closest(".cm-editor") && stateRef.current.selectedId) dispatch({ type: "select", id: null });
    };
    const leave = () => {
      overShape.current = false;
      routePointer();
    };
    // The wheel over the page (text or canvas) scrolls and zooms the page; the text never scrolls on its own.
    const wheel = (e: WheelEvent) => {
      const wrap = handleRef.current?.container();
      if (!wrap || !(e.target instanceof Node) || !wrap.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const r = wrap.getBoundingClientRect();
      onWheelAt(e, { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    body.addEventListener("pointermove", move, true);
    body.addEventListener("pointerdown", down, true);
    body.addEventListener("pointerleave", leave);
    body.addEventListener("wheel", wheel, { capture: true, passive: false });
    return () => {
      body.removeEventListener("pointermove", move, true);
      body.removeEventListener("pointerdown", down, true);
      body.removeEventListener("pointerleave", leave);
      body.removeEventListener("wheel", wheel, true);
    };
  }, [dispatch, onWheelAt, routePointer, stateRef]);

  // ---------- Pictures: paste and Insert image ----------
  const placePicture = useCallback(
    async (file: Blob, name: string | null, verb: string) => {
      try {
        const url = await readDataUrl(file);
        if (!/^data:image\//.test(url)) throw new Error("That file is not a picture.");
        const q = pRef.current;
        const taken = q.pictureNames();
        const fileName = name ? pictureFileName(name, taken) : pastedName(taken);
        const rel = q.addPicture(url, fileName);
        // (A) T49: the alt text is the file's name without its extension, pasted or inserted.
        const line = imageLink(fileName.replace(/\.[^.]+$/, ""), rel);
        const v = cmRef.current;
        if (v) v.dispatch(imageLinkTool(v.state, line, { atEnd: !session.caret }));
        q.hint(`${verb} image saved to ${rel} and linked`);
      } catch (e) {
        pRef.current.notify({ tone: "error", title: "Could not add the picture", description: e instanceof Error ? e.message : String(e) });
      }
    },
    [session],
  );
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void placePicture(f, f.name, "Inserted");
  };

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
  // T45 (6.6, A): on a Markdown tab the main image is the page: Add border puts a rectangle callout on its edge.
  const onAddBorder = useCallback(() => {
    setTool("select");
    const { color: c, strokeWidth: w, pageH: h } = live.current;
    onAdd({ type: "rect", x: 0, y: 0, w: PAGE_W, h, stroke: c ?? lastColorRef.current, strokeWidth: w } as NewShape, true);
  }, [onAdd, setTool]);
  const onUpdate = useCallback((id: string, patch: ShapePatch) => dispatch({ type: "update", id, patch }), [dispatch]);
  const onRemove = useCallback((id: string) => dispatch({ type: "remove", id }), [dispatch]);
  const onRemoveMany = useCallback((ids: string[]) => dispatch({ type: "removeMany", ids }), [dispatch]);
  const onReorder = useCallback((id: string, index: number) => dispatch({ type: "reorder", id, index }), [dispatch]);
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
    savePenMemory("markdown", { role: c, stroke: strokeWidth });
    restyle({ stroke: c });
  };
  const setStrokeWidth = (w: number) => {
    setStrokeWidthState(w);
    savePenMemory("markdown", { role: lastColor, stroke: w });
    restyle({ strokeWidth: w });
  };

  // ---------- Copy PNG and Export: the visible page with its callouts ----------
  const rootRef = useRef<HTMLDivElement | null>(null);
  const renderVisible = useCallback(async (): Promise<Flattened> => {
    const stage = handleRef.current?.stage();
    const root = rootRef.current;
    if (!stage || !root) throw new Error("The page is not on screen yet. Try again.");
    const v = live.current.view;
    const s = sizeRef.current;
    const seen = { x: -v.x / v.scale, y: -v.y / v.scale, w: s.width / v.scale, h: s.height / v.scale };
    const all = printArea(pageImage, stateRef.current.doc?.shapes ?? [], handleRef.current?.notes() ?? new Map());
    const x0 = Math.max(seen.x, all.x);
    const y0 = Math.max(seen.y, all.y);
    const x1 = Math.min(seen.x + seen.w, all.x + all.w);
    const y1 = Math.min(seen.y + seen.h, all.y + all.h);
    if (x1 - x0 < 1 || y1 - y0 < 1) throw new Error("No part of the page is in view.");
    const area = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    let under: Under | undefined;
    try {
      // The page as markdown-it draws it (no marks), under the callouts at the same page pixels.
      const pg = await renderedPage(root, session.text, pRef.current.resolve);
      under = { image: pg.image, width: PAGE_W, height: pg.height };
    } catch {
      under = undefined; // the callouts alone, on the canvas colour
    }
    const bg = cssVar("--bg-canvas");
    try {
      return flattenArea(stage, area, bg, { under, pixelRatio: 2 });
    } catch (e) {
      if (!under) throw e;
      return flattenArea(stage, area, bg, { pixelRatio: 2 });
    }
  }, [pageImage, session, stateRef]);

  const onCopy = useCallback(() => {
    pRef.current.notify(null);
    void renderVisible()
      .then(async (f) => {
        await copyPngToClipboard(f.dataUrl);
        pRef.current.hint(`Copied the visible page and its callouts as a PNG · ${f.width} × ${f.height}`);
      })
      .catch((e: unknown) => pRef.current.notify({ tone: "error", title: "Copy failed", description: e instanceof Error ? e.message : String(e) }));
  }, [renderVisible]);

  // T45 (6.4): Save as PNG, JPEG or PDF (the picture Copy gives), TXT or MD (the file's text).
  const onSaveAs = useCallback(
    (f: SaveFormat) => {
      const q = pRef.current;
      q.notify(null);
      const name = saveAsName(session.name, f);
      const done = f === "txt" || f === "md" ? deliver(session.text, name, f) : renderVisible().then((pic) => savePicture(pic.dataUrl, f, name));
      done.then(
        (where) => q.hint(`Saved ${where}`),
        (e: unknown) => q.notify({ tone: "error", title: "Save as failed", description: e instanceof Error ? e.message : String(e) }),
      );
    },
    [renderVisible, session],
  );

  // RUN3 T35: the visible page with its callouts (what Copy PNG gives); the rendered page alone without a canvas.
  const collideContent = useCallback(async () => {
    const doc = stateRef.current.doc;
    let preview: Uint8Array;
    try {
      if (handleRef.current?.stage()) preview = new Uint8Array(await dataUrlToBlob((await renderVisible()).dataUrl).arrayBuffer());
      else if (rootRef.current) preview = await pngOf((await renderedPage(rootRef.current, session.text, pRef.current.resolve)).image);
      else preview = await blankPng();
    } catch {
      preview = await blankPng();
    }
    return { text: session.text, shapes: [...(doc?.shapes ?? [])], preview };
  }, [renderVisible, session, stateRef]);

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
      // In the text, the zoom keys still zoom the page; every other key is the editor's.
      const inText = e.target instanceof Element && !!e.target.closest(".cm-editor");
      if (inText && ctrl && !e.altKey && (k === "0" || k === "=" || k === "+" || k === "-")) {
        e.preventDefault();
        if (k === "0") fit();
        else zoomBy(k === "-" ? -1 : 1);
        return;
      }
      if (isTyping(e.target) || e.altKey) return;
      // T48: the plain F key fits, like Ctrl+0 (never while typing: fitKey.ts).
      if (isFitKey(e)) {
        e.preventDefault();
        fit();
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
  }, [dispatch, fit, onCopy, redo, save, setTool, stateRef, undo, zoomBy]);

  // With a drawing tool on, a press outside the page pane (not on the toolbar) goes back to Select and still lands.
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
    const api: MdEditorApi = {
      refInput: () => ({
        mode: "preview", // T49: one view, the page you type into and mark up
        shapes: stateRef.current.doc?.shapes ?? [],
        selectedId: stateRef.current.selectedId,
        tool: live.current.tool,
        color: live.current.color,
        strokeWidth: live.current.strokeWidth,
        scale: live.current.view.scale,
        fitted: fittedRef.current,
        bubbles: handleRef.current?.notes(),
      }),
      pasteImage: (file) => void placePicture(file, null, "Pasted"),
      save: () => save(),
      markSaved: () => save(true),
      collideContent,
    };
    apiRef.current = api;
    return () => {
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [apiRef, placePicture, save, stateRef, collideContent]);

  // ---------- Render ----------
  const callouts = shapes.filter(isCallout).length;
  const lines = text.split("\n").length;
  const tail = (
    <>
      <button type="button" className="btn icon" aria-label="Full width" aria-pressed={full} title={full ? "Show the sidebar and callouts" : "Full width: hide the sidebar and callouts"} onClick={p.onFull}>
        <Icon name="maximize" />
      </button>
      <button
        type="button"
        className="btn icon"
        aria-label={hideTools ? "Show the toolbar" : "Hide the toolbar"}
        aria-pressed={!hideTools}
        title={hideTools ? "Show the toolbar" : "Hide the toolbar"}
        onClick={p.onHideTools}
      >
        <Icon name={hideTools ? "chevron-down" : "chevron-up"} />
      </button>
    </>
  );
  const insertButton = (
    <button type="button" className="tbtn" title="Insert image: the picture goes into images/ with a link in the file" onClick={() => fileRef.current?.click()}>
      <Icon name="image-plus" size={14} />
      <span>Insert image</span>
    </button>
  );

  return (
    <div className="wsfill mdedit" data-theme-key={themeKey} ref={rootRef}>
      {p.head({ onSave: () => save(), canSave: true, extra: null, tail, onCopy, saveAs: { formats: saveAsFormats("markdown"), onSave: onSaveAs } })}
      <Toolbar
        label="Markdown tools"
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
        second={
          <>
            {/* T49: the text tools act on the live page's selection, always on. */}
            <label className="tbtn hsel">
              <Icon name="heading" size={14} />
              <select
                aria-label="Heading"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== "") applyTool((s) => headingTool(s, Number(v)));
                }}
              >
                <option value="">Heading</option>
                <option value="0">Normal text</option>
                <option value="1">Heading 1</option>
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
              </select>
            </label>
            <button type="button" className="tbtn" aria-label="Bulleted list" title="Bulleted list" onClick={() => applyTool(listTool)}>
              <Icon name="list" size={14} />
              List
            </button>
            <button type="button" className="tbtn" aria-label="Insert a table" title="Insert a table" onClick={() => applyTool(tableTool)}>
              <Icon name="table" size={14} />
              Table
            </button>
            <button type="button" className="tbtn" aria-label="Label line" title="Label line, like **Status:** PASS" onClick={() => applyTool(labelTool)}>
              <Icon name="tag" size={14} />
              Label
            </button>
            <button type="button" className="tbtn" aria-label="Numbered list" title="Numbered list" onClick={() => applyTool(numListTool)}>
              <Icon name="list-ordered" size={14} />
              Num list
            </button>
            <span className="vsep" />
            <button type="button" className="tool" aria-label="Bold" title="Bold (Ctrl+B)" onClick={() => applyTool(boldTool)}>
              <Icon name="bold" />
            </button>
            <button type="button" className="tool" aria-label="Link" title="Link" onClick={() => applyTool(linkTool)}>
              <Icon name="link" />
            </button>
            <span className="vsep" />
            {insertButton}
          </>
        }
      />
      <div ref={bodyRef} className={`mdbody${!full ? " with-list" : ""}`}>
        <Canvas
          image={pageImage}
          shapes={shapes}
          selectedId={state.selectedId}
          tool={tool}
          style={{ stroke: color ?? lastColor, strokeWidth }}
          view={view}
          onViewChange={setViewState /* a right-drag or Space-drag pan: the zoom stays as it was */}
          onSize={onSize}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onRemoveMany={onRemoveMany}
          onSelect={onSelect}
          handleRef={handleRef}
          onWheelAt={onWheelAt}
          underlay={
            <div className="mdpage mdcm" ref={measure} data-tool={tool}>
              <div ref={host} />
            </div>
          }
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
        <span>{session.zipName}</span>
        <span>UTF-8 · LF</span>
        <span>{`${callouts} callout${callouts === 1 ? "" : "s"} on the page`}</span>
        <span title="Ctrl + mouse wheel zooms; Ctrl+0 or F fits">{`${Math.round(view.scale * 100)}%${fittedRef.current ? " · fit" : ""}`}</span>
        <span style={{ marginLeft: "auto" }}>{`${lines} lines`}</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}
