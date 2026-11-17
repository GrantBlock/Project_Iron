// The model view (L06): the prototype's frame (ui/views.ts) with the 3D viewer in the
// viewport, a Fit to view button, a "Sample model" tag for generated samples, and a parts list
// that selects and highlights a part (clicking a part in the viewer selects its row). If
// WebGL is not available the prototype's placeholder stays and the parts list still works.
import type { ModelItem } from "../data/sample";
import { selectPart, type AppState, type Store } from "../state";
import { isSample, readGlbJson } from "../viewer/glb";
import { SAMPLE_MODEL_URLS } from "../viewer/sample-models";
import type { ModelViewer } from "../viewer/viewer";
import { el } from "./dom";
import { modelView } from "./views";

export interface ViewHandle {
  readonly nodes: Node[];
  update(s: AppState): void;
  dispose(): void;
}

/** Where a model's GLB comes from: a bundled sample URL now; bytes from disk in L08. */
export type ModelSource = string | ArrayBuffer;

export function modelSource(item: ModelItem): ModelSource | undefined {
  return SAMPLE_MODEL_URLS[item.id];
}

export function createModelView(item: ModelItem, store: Store, source: ModelSource | undefined = modelSource(item)): ViewHandle {
  const nodes = modelView(item);
  const holder = document.createElement("div");
  holder.append(...nodes);
  const viewport = holder.querySelector<HTMLElement>(".l-viewport");
  const rows = [...holder.querySelectorAll<HTMLButtonElement>(".l-part")];
  for (const row of rows) {
    row.addEventListener("click", () => store.update((s) => selectPart(s, s.part === row.dataset.part ? null : (row.dataset.part ?? null))));
  }

  let viewer: ModelViewer | null = null;
  let disposed = false;
  let part: string | null = null;

  const fail = (reason: unknown) => {
    if (!viewport) return;
    viewport.dataset.state = "error";
    viewport.title = "The 3D view is not available on this computer.";
    console.warn("[lite] 3D viewer:", reason);
  };

  if (viewport && source !== undefined) {
    void (async () => {
      try {
        const bytes = typeof source === "string" ? await (await fetch(source)).arrayBuffer() : source;
        const { createViewer } = await import("../viewer/viewer");
        if (disposed) return;
        const steel = getComputedStyle(document.documentElement).getPropertyValue("--bc-steel-blue").trim() || "steelblue";
        viewer = createViewer(viewport, { highlight: steel });
        viewer.onPick((name) => store.update((s) => selectPart(s, name)));
        await viewer.load(bytes);
        if (disposed) return;
        viewer.selectPart(part);
        const fit = el("button", { class: "l-b l-fit", type: "button" }, "Fit to view");
        fit.addEventListener("click", () => viewer?.fitToView());
        viewport.append(fit);
        if (isSample(readGlbJson(bytes))) viewport.append(el("span", { class: "de-tag l-sample" }, "Sample model"));
        viewport.dataset.state = "ready";
      } catch (e) {
        if (!disposed) fail(e);
      }
    })();
  } else if (viewport) {
    fail("no model file");
  }

  return {
    nodes,
    update(s) {
      if (s.part === part) return;
      part = s.part;
      for (const row of rows) {
        const on = row.dataset.part === part;
        row.classList.toggle("is-on", on);
        row.setAttribute("aria-pressed", String(on));
      }
      viewer?.selectPart(part);
    },
    dispose() {
      disposed = true;
      viewer?.dispose();
      viewer = null;
    },
  };
}
