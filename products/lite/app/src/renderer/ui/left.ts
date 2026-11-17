// Left side: package name and client line, Search this package, the tree, the offline line.
// Tree: About this package, then one folder per project with its documents, models and notes;
// folders collapse, rows select (steel-blue left edge on the selected row).
import { ABOUT_LABEL, PACKAGE, type Item, type ItemType } from "../data/sample";
import { ABOUT, select, setQuery, toggleFolder, treeFolders, type AppState, type Store } from "../state";
import { el, type Area } from "./dom";
import { icon, type IconName } from "./icons";

const ITEM_ICON: Record<ItemType, IconName> = { document: "document", model: "model", note: "note" };

export function createLeft(store: Store, isNarrow: () => boolean): Area<AppState> {
  const input = el("input", { id: "q", placeholder: "Search this package", autocomplete: "off", "aria-label": "Search this package" });
  input.addEventListener("input", () => store.update((s) => setQuery(s, input.value)));
  const tree = el("div", { class: "l-tree", id: "tree" });
  tree.addEventListener("click", (e) => {
    const target = e.target as Element;
    const group = target.closest<HTMLElement>("[data-g]");
    if (group) {
      store.update((s) => toggleFolder(s, group.dataset.g ?? ""));
      return;
    }
    const row = target.closest<HTMLElement>("[data-s]");
    if (row) store.update((s) => select(s, row.dataset.s ?? ABOUT, { highlight: s.query.trim(), narrow: isNarrow() }));
  });

  const element = el(
    "aside",
    { class: "l-left", "aria-label": "Package files" },
    el("div", { class: "l-pk" }, el("b", { id: "pkt" }, PACKAGE.title), el("span", {}, PACKAGE.byline)),
    el("label", { class: "l-find" }, icon("search"), input),
    tree,
    el("div", { class: "l-foot" }, el("span", { class: "l-dot" }), el("span", {}, "Offline. Nothing leaves this computer.")),
  );

  let builtFor = "";
  return {
    element,
    render(s) {
      const folders = treeFolders(s);
      // Rebuild when the rows change (selection, listed items); otherwise only open or close
      // folders in place, so the chevron animates as in the prototype.
      const key = JSON.stringify([s.selected, folders.map((f) => [f.project.name, f.items.map((i) => i.id)])]);
      if (key === builtFor) {
        for (const g of tree.querySelectorAll<HTMLElement>(".l-grp")) {
          const head = g.querySelector<HTMLElement>("[data-g]");
          const open = !s.closedFolders.includes(head?.dataset.g ?? "");
          g.classList.toggle("is-closed", !open);
          head?.setAttribute("aria-expanded", String(open));
        }
        return;
      }
      builtFor = key;
      const focused = tree.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
      const focusKey = focused?.dataset.s ? `[data-s="${focused.dataset.s}"]` : focused?.dataset.g ? `[data-g="${CSS.escape(focused.dataset.g)}"]` : "";
      tree.replaceChildren(
        el("button", { class: s.selected === ABOUT ? "l-top is-on" : "l-top", type: "button", "data-s": ABOUT }, icon("about"), ABOUT_LABEL),
        ...folders.map((f) =>
          el(
            "div",
            { class: f.open ? "l-grp" : "l-grp is-closed" },
            el(
              "button",
              { class: "l-gh", type: "button", "data-g": f.project.name, "aria-expanded": String(f.open) },
              icon("chevron", 12),
              el("span", {}, f.project.name),
              el("span", {}, String(f.items.length)),
            ),
            el("div", { class: "l-kids" }, ...f.items.map((i) => row(i, s.selected === i.id))),
          ),
        ),
      );
      if (focusKey) tree.querySelector<HTMLElement>(focusKey)?.focus();
    },
  };
}

function row(item: Item, on: boolean): HTMLButtonElement {
  return el("button", { class: on ? "l-it is-on" : "l-it", type: "button", "data-s": item.id }, icon(ITEM_ICON[item.type]), el("span", {}, item.title));
}
