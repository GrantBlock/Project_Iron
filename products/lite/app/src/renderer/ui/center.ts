// Center: the path bar with the Read only tag, and the view (ui/views.ts).
import type { Item } from "../data/sample";
import { pathParts, selectedItem, turnPage, type AppState, type Store } from "../state";
import { el, type Area } from "./dom";
import { createModelView, type ViewHandle } from "./model-view";
import { createPdfView } from "./pdf-view";
import { renderView } from "./views";

/** Reads a file of the opened folder (the preload bridge; absent outside the Electron app). */
export type FileReader = (path: string) => Promise<Uint8Array>;

export function createCenter(store: Store, readFile?: FileReader): Area<AppState> {
  const crumb = el("span", { class: "l-crumb", id: "crumb" });
  const view = el("div", { class: "l-view de-scroll", id: "view", tabindex: "0" });
  view.addEventListener("click", (e) => {
    const button = (e.target as Element).closest("button");
    if (button?.id === "pp") store.update((s) => turnPage(s, -1));
    if (button?.id === "pn") store.update((s) => turnPage(s, 1));
  });
  const element = el(
    "main",
    { class: "l-mid", "aria-label": "Viewer", id: "de-main", tabindex: "-1" },
    el("div", { class: "l-bar" }, crumb, el("span", { class: "sp" }), el("span", { class: "de-tag" }, "Read only")),
    view,
  );
  let handle: ViewHandle | null = null;
  return {
    element,
    render(s, prev) {
      handle?.update(s);
      const sameItem = prev && prev.opened === s.opened && prev.selected === s.selected;
      // A view with a handle (model, PDF) follows page and part changes itself.
      if (sameItem && (handle || (prev.page === s.page && prev.highlight === s.highlight))) return;
      const item = selectedItem(s);
      const { folders, title } = pathParts(s);
      crumb.replaceChildren(...(title === null ? [el("b", {}, "About this package")] : [folders.map((f) => `${f} / `).join(""), el("b", {}, title)]));
      // Keep the keyboard on Previous / Next across page turns (the other one when it is now disabled).
      const focused = view.contains(document.activeElement) ? document.activeElement?.id : undefined;
      handle?.dispose();
      handle = item ? viewHandle(item, store, readFile) : null;
      view.replaceChildren(...(handle ? handle.nodes : renderView(s)));
      handle?.update(s);
      if (focused === "pp" || focused === "pn") {
        const same = view.querySelector<HTMLButtonElement>(`#${focused}`);
        const other = view.querySelector<HTMLButtonElement>(focused === "pp" ? "#pn" : "#pp");
        (same && !same.disabled ? same : other)?.focus();
      }
      if (!prev || prev.opened !== s.opened) view.scrollTop = 0;
    },
  };
}

/** Views that load and follow the state themselves: models (3D viewer) and PDFs. */
function viewHandle(item: Item, store: Store, readFile: FileReader | undefined): ViewHandle | null {
  const src = item.source;
  const read = src && readFile ? () => readFile(src.path) : undefined;
  if (item.type === "model") return createModelView(item, store, src ? read : undefined);
  if (item.type === "document" && src?.kind === "pdf" && read) return createPdfView(item, read);
  return null;
}
