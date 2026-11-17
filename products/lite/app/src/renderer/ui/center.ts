// Center: the path bar with the Read only tag, and the view. L03 draws each view's heading
// and subtitle; L04 adds the bodies (About details, document pages, parts list, note text).
import { PACKAGE } from "../data/sample";
import { pathText, selectedItem, type AppState } from "../state";
import { el, type Area } from "./dom";
import { projectOf } from "../data/sample";

export function createCenter(): Area<AppState> {
  const crumb = el("span", { class: "l-crumb", id: "crumb" });
  const view = el("div", { class: "l-view de-scroll", id: "view", tabindex: "0" });
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
      view.replaceChildren(...heading(s));
      if (!prev || prev.selected !== s.selected) view.scrollTop = 0;
    },
  };
}

/** The view's heading and subtitle, as the prototype's views start. */
function heading(s: AppState): Node[] {
  const item = selectedItem(s);
  if (!item) return [el("h1", {}, PACKAGE.title), el("div", { class: "sub" }, PACKAGE.openedFrom)];
  const sub = item.type === "document" ? `Document · ${item.pages.length} pages` : item.type === "model" ? "3D model · read only" : "Note";
  return [el("h1", {}, item.title), el("div", { class: "sub" }, sub)];
}
