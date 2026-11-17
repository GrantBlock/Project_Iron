// Left side: package name and client line, Search this package, the tree, the offline line.
// Tree: About this package, then one folder per project with its documents, models and notes;
// folders collapse, rows select (steel-blue left edge on the selected row). L08: an opened
// folder shows under the sample as a second package (its sub-folders as nested groups), and,
// in the Electron app only, Open folder sits in the bottom line. Names are text nodes.
import { ABOUT_LABEL, PACKAGE, type Item, type ItemType } from "../data/sample";
import { NO_MATCHES, normalizeQuery } from "../search";
import { ABOUT, diskTree, select, setQuery, toggleFolder, treeFolders, type AppState, type DiskTreeNode, type Store } from "../state";
import { el, type Area } from "./dom";
import { icon, type IconName } from "./icons";

const ITEM_ICON: Record<ItemType, IconName> = { document: "document", model: "model", note: "note" };

/** Opens a folder (the system dialog, then loading its files); absent outside the Electron app. */
export type FolderOpener = () => Promise<void>;

export function createLeft(store: Store, isNarrow: () => boolean, openFolder?: FolderOpener): Area<AppState> {
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
    el("div", { class: "l-foot" }, el("span", { class: "l-dot" }), el("span", {}, "Offline. Nothing leaves this computer."), openFolder ? openButton(openFolder) : null),
  );

  let builtFor = "";
  return {
    element,
    render(s) {
      const folders = treeFolders(s);
      // Rebuild when the rows change (selection, listed items); otherwise only open or close
      // folders in place, so the chevron animates as in the prototype.
      const searching = normalizeQuery(s.query) !== "";
      const disk = diskTree(s);
      const key = JSON.stringify([s.selected, searching, folders.map((f) => [f.project.name, f.items.map((i) => i.id)]), disk && shape(disk)]);
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
      const focusKey = focused?.dataset.s ? `[data-s="${CSS.escape(focused.dataset.s)}"]` : focused?.dataset.g ? `[data-g="${CSS.escape(focused.dataset.g)}"]` : "";
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
        ...(disk ? [el("div", { class: "l-sep de-label" }, "Opened folder"), diskGroup(disk, s.selected)] : []),
        ...(searching && folders.length === 0 && !disk ? [el("div", { class: "l-empty" }, NO_MATCHES)] : []),
      );
      if (focusKey) tree.querySelector<HTMLElement>(focusKey)?.focus();
    },
  };
}

function row(item: Item, on: boolean): HTMLButtonElement {
  const kind = item.source?.problem ? "file" : item.source?.kind === "pdf" ? "document" : ITEM_ICON[item.type];
  return el("button", { class: on ? "l-it is-on" : "l-it", type: "button", "data-s": item.id, title: item.source?.path }, icon(kind), el("span", {}, item.title));
}

/** A folder of the opened package: its row (name and listed-file count), sub-folders, then files. */
function diskGroup(n: DiskTreeNode, selected: string): HTMLElement {
  return el(
    "div",
    { class: n.open ? "l-grp" : "l-grp is-closed" },
    el(
      "button",
      { class: "l-gh", type: "button", "data-g": n.key, "aria-expanded": String(n.open) },
      icon("chevron", 12),
      el("span", {}, n.name),
      el("span", {}, String(n.count)),
    ),
    el("div", { class: "l-kids" }, ...n.folders.map((f) => diskGroup(f, selected)), ...n.files.map((i) => row(i, selected === i.id))),
  );
}

/** What decides the opened folder's rows (rebuild when it changes). */
function shape(n: DiskTreeNode): unknown {
  return [n.key, n.files.map((f) => f.id), n.folders.map(shape)];
}

function openButton(openFolder: FolderOpener): HTMLButtonElement {
  const button = el("button", { class: "l-b l-open", type: "button" }, icon("folder", 14), "Open folder");
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.lastChild!.textContent = "Opening…";
    try {
      await openFolder();
      button.removeAttribute("title");
    } catch (e) {
      button.title = "Lite could not open that folder.";
      console.warn("[lite] Open folder:", e);
    } finally {
      button.disabled = false;
      button.lastChild!.textContent = "Open folder";
    }
  });
  return button;
}
