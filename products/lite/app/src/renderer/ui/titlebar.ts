// Title bar: the mark, "Lite", the package name, the Assistant button (hides and shows the
// right side) and the window controls, as the prototype draws them. In the Electron app the
// window is frameless (Grant 2026-11-17, ISSUES.md 7): the drawn minimize / maximize-restore /
// close are buttons wired to the window through the preload, the title bar drags the window
// (styles/shell.css, `.is-desktop`), and a double-click on it maximizes or restores.
import faviconUrl from "../../../../prototype/assets/favicon.svg";
import type { WindowControls } from "../bridge";
import { PACKAGE } from "../data/sample";
import { toggleAssistant, type AppState, type Store } from "../state";
import { el, type Area } from "./dom";
import { icon } from "./icons";

export function createTitleBar(store: Store, options: { windowControls?: WindowControls }): Area<AppState> {
  const button = el("button", { class: "de-btn", id: "chatbtn", type: "button", "aria-pressed": "true" }, icon("chat"), "Assistant");
  button.addEventListener("click", () => store.update(toggleAssistant));
  const win = options.windowControls;
  const element = el(
    "header",
    { class: "l-title" },
    el("img", { src: faviconUrl, alt: "" }),
    el("span", { class: "l-tn" }, "Lite"),
    el("span", { class: "l-tp", id: "tp" }, PACKAGE.title),
    el("span", { class: "l-sp" }),
    button,
    win ? windowButtons(win) : drawnControls(),
  );
  if (win) {
    // Windows treats the drag region as the caption and maximizes on a double-click itself (the
    // page gets no event there); elsewhere the page does it.
    element.addEventListener("dblclick", (e) => {
      if (!(e.target as Element).closest("button")) win.toggleMaximize();
    });
  }
  return {
    element,
    render(s) {
      button.setAttribute("aria-pressed", String(s.assistantShown));
    },
  };
}

/** The web build: the prototype's drawn controls, decorative (there is no window to control). */
function drawnControls(): HTMLElement {
  return el(
    "div",
    { class: "l-wc", "aria-hidden": "true" },
    el("span", {}, icon("minimize", 14, { plain: true })),
    el("span", {}, icon("maximize", 14, { plain: true })),
    el("span", {}, icon("close", 14, { plain: true })),
  );
}

/** The Electron app: the same drawn icons as working buttons; maximize shows restore while maximized. */
function windowButtons(win: WindowControls): HTMLElement {
  const make = (label: string, name: "minimize" | "maximize" | "close", action: () => void) => {
    const b = el("button", { class: "l-wb", type: "button", "aria-label": label, title: label }, icon(name, 14, { plain: true }));
    b.addEventListener("click", action);
    return b;
  };
  const minimize = make("Minimize", "minimize", () => win.minimize());
  const maximize = make("Maximize", "maximize", () => win.toggleMaximize());
  const close = make("Close", "close", () => win.close());
  close.classList.add("l-wb-close");
  maximize.dataset.maximized = "false";
  win.onMaximizedChange((maximized) => {
    const label = maximized ? "Restore" : "Maximize";
    maximize.dataset.maximized = String(maximized);
    maximize.setAttribute("aria-label", label);
    maximize.title = label;
    maximize.replaceChildren(icon(maximized ? "restore" : "maximize", 14, { plain: true }));
  });
  return el("div", { class: "l-wc", role: "group", "aria-label": "Window" }, minimize, maximize, close);
}
