// The Lite window, as the prototype (prototype/exports/P16-lite/index.html): a title bar,
// the Files / View / Assistant tabs (under 900px only), and three panes: left (package and
// tree, ui/left.ts), center (path bar and view, ui/center.ts), right (the Assistant,
// ui/right.ts). State lives in state.ts, the sample content in data/sample.ts; each area
// re-renders from the state. `window.__lite.state()` (hook.ts) is the read-only test hook.
import { installHook } from "./hook";
import { createStore, type AppState, type Store } from "./state";
import { createCenter } from "./ui/center";
import { el, type Area } from "./ui/dom";
import { createLeft } from "./ui/left";
import { createRight } from "./ui/right";
import { createTabs } from "./ui/tabs";
import { createTitleBar } from "./ui/titlebar";

/** Under this width the panes become tabs (the prototype's breakpoint). */
export const NARROW_QUERY = "(max-width:900px)";

/** Builds the app inside `root`, replacing whatever was there. Returns the app's element. */
export function mountApp(root: HTMLElement, store: Store = createStore()): HTMLElement {
  const narrow = window.matchMedia(NARROW_QUERY);
  const isNarrow = () => narrow.matches;
  const titleBar = createTitleBar(store, { desktop: window.lite?.desktop === true });
  const tabs = createTabs(store);
  const left = createLeft(store, isNarrow);
  const center = createCenter();
  const right = createRight();
  const body = el("div", { class: "l-body", id: "body" }, left.element, center.element, right.element);
  const areas: Area<AppState>[] = [titleBar, tabs, left, center, right];

  const app = el(
    "div",
    { class: "lite", "data-testid": "app-root" },
    el("a", { class: "dx-skip", href: "#de-main" }, "Skip to content"),
    el("div", { class: "l-win" }, el("div", { class: "l-frame" }, titleBar.element, tabs.element, body)),
  );

  const render = (s: AppState, prev?: AppState) => {
    body.dataset.p = s.pane;
    body.classList.toggle("no-chat", !s.assistantShown);
    for (const a of areas) a.render(s, prev);
  };
  render(store.get());
  store.subscribe(render);

  installHook(store, () => ({ narrow: isNarrow(), highlights: center.element.querySelectorAll("mark").length }));
  root.replaceChildren(app);
  return app;
}
