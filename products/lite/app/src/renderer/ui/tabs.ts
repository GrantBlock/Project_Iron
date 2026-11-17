// Under 900px: the Files / View / Assistant tabs (CSS shows them; the state keeps the pane).
import { setPane, type AppState, type Pane, type Store } from "../state";
import { el, type Area } from "./dom";

const TABS: readonly [Pane, string][] = [
  ["files", "Files"],
  ["view", "View"],
  ["chat", "Assistant"],
];

export function createTabs(store: Store): Area<AppState> {
  const buttons = TABS.map(([pane, label]) => {
    const b = el("button", { role: "tab", "data-p": pane, "aria-selected": "false" }, label);
    b.addEventListener("click", () => store.update((s) => setPane(s, pane)));
    return b;
  });
  const list = el("div", { class: "l-tabs", id: "tabs", role: "tablist", "aria-label": "Panes" }, ...buttons);
  return {
    element: el("nav", { "aria-label": "Panes" }, list),
    render(s) {
      for (const b of buttons) b.setAttribute("aria-selected", String(b.dataset.p === s.pane));
    },
  };
}
