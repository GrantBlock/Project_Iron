// Center: the path bar with the Read only tag, and the view (ui/views.ts).
import { projectOf } from "../data/sample";
import { pathText, selectedItem, turnPage, type AppState, type Store } from "../state";
import { el, type Area } from "./dom";
import { renderView } from "./views";

export function createCenter(store: Store): Area<AppState> {
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
  return {
    element,
    render(s, prev) {
      if (prev && prev.selected === s.selected && prev.page === s.page && prev.highlight === s.highlight) return;
      const item = selectedItem(s);
      const project = item && projectOf(item.id);
      crumb.replaceChildren(...(item && project ? [`${project.name} / `, el("b", {}, item.title)] : [el("b", {}, pathText(s))]));
      // Keep the keyboard on Previous / Next across page turns (the other one when it is now disabled).
      const focused = view.contains(document.activeElement) ? document.activeElement?.id : undefined;
      view.replaceChildren(...renderView(s));
      if (focused === "pp" || focused === "pn") {
        const same = view.querySelector<HTMLButtonElement>(`#${focused}`);
        const other = view.querySelector<HTMLButtonElement>(focused === "pp" ? "#pn" : "#pp");
        (same && !same.disabled ? same : other)?.focus();
      }
      if (!prev || prev.selected !== s.selected) view.scrollTop = 0;
    },
  };
}
