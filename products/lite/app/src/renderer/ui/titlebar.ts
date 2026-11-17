// Title bar: the mark, "Lite", the package name, the Assistant button (hides and shows the
// right side) and the window controls, as the prototype draws them.
import faviconUrl from "../../../../prototype/assets/favicon.svg";
import { PACKAGE } from "../data/sample";
import { toggleAssistant, type AppState, type Store } from "../state";
import { el, type Area } from "./dom";
import { icon } from "./icons";

export function createTitleBar(store: Store, options: { desktop: boolean }): Area<AppState> {
  const button = el("button", { class: "de-btn", id: "chatbtn", type: "button", "aria-pressed": "true" }, icon("chat"), "Assistant");
  button.addEventListener("click", () => store.update(toggleAssistant));
  // The prototype draws minimize / maximize / close. In the Electron app the system frame has
  // the working ones, so these drawn ones are left out there (A, see the L03 report).
  const controls = options.desktop
    ? null
    : el(
        "div",
        { class: "l-wc", "aria-hidden": "true" },
        el("span", {}, icon("minimize", 14, { plain: true })),
        el("span", {}, icon("maximize", 14, { plain: true })),
        el("span", {}, icon("close", 14, { plain: true })),
      );
  const element = el(
    "header",
    { class: "l-title" },
    el("img", { src: faviconUrl, alt: "" }),
    el("span", { class: "l-tn" }, "Lite"),
    el("span", { class: "l-tp", id: "tp" }, PACKAGE.title),
    el("span", { class: "l-sp" }),
    button,
    controls,
  );
  return {
    element,
    render(s) {
      button.setAttribute("aria-pressed", String(s.assistantShown));
    },
  };
}
