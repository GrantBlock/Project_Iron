import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { AnnotationsDoc, Shape } from "../model";
import { GlassPanel } from "../ds";
import { Canvas, cssVar, type CanvasHandle, type LoadedImage } from "./Canvas";
import { nextShapeId, type NewShape, type ShapePatch } from "./store";
import { DEFAULT_STROKE_WIDTH, TOOL_KEYS, type Tool } from "./tools";
import { useEditorStore } from "./useEditorStore";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
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

const nameFromUrl = (url: string) => decodeURIComponent(url.split("?")[0].split("/").pop() || "image");

export interface CollideTestState {
  image: { name: string; width: number; height: number } | null;
  stage: { scale: number; x: number; y: number; width: number; height: number } | null;
  /** Shape data as stored (image pixels). */
  shapes: { id: string; x: number; y: number; w: number; h: number }[];
  /** Shape positions measured from the Konva nodes and converted to image-relative coordinates. */
  shapesOnImage: { id: string; x: number; y: number }[];
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
}

declare global {
  interface Window {
    __collide?: CollideHook;
  }
}

export function EditorShell() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const { state, dispatch, stateRef } = useEditorStore();
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

  const open = useCallback(async (url: string, name: string) => {
    const img = await loadImage(url, name);
    setImage(img);
    dispatch({ type: "load", width: img.width, height: img.height });
    setView(fitView(sizeRef.current, img));
    live.current = { image: img, view: fitView(sizeRef.current, img) };
    return { width: img.width, height: img.height };
  }, [dispatch]);

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
        dispatch({
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
        });
        return id;
      },
      getDoc: () => stateRef.current.doc,
      screenToImage: (p) => screenToImage(live.current.view, p),
      getState: () => {
        const { image: img } = live.current;
        const ss = stateRef.current.doc?.shapes ?? [];
        const stage = handleRef.current?.stage() ?? null;
        const bg = stage?.findOne(".background") ?? null;
        const inv = bg?.getAbsoluteTransform().copy().invert();
        return {
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
  }, [open, dispatch, stateRef]);

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
          <div
            data-testid="ai-pane"
            style={{ width: "var(--layout-inspector)", flex: "none", borderLeft: "1px solid var(--line-1)", boxSizing: "border-box" }}
          />
        </div>
        <StatusBar zoom={view.scale} dims={image && { width: image.width, height: image.height }} />
      </GlassPanel>
      <input ref={fileRef} type="file" accept="image/*" hidden data-testid="file-input" onChange={onFile} />
    </div>
  );
}
