// Right side: the Assistant panel frame (On this computer), the message list and the
// composer. L07 fills it: greeting, suggested questions, canned answers, citations.
import { ASSISTANT_TEXT } from "../data/sample";
import type { AppState } from "../state";
import { el, type Area } from "./dom";
import { icon } from "./icons";

export function createRight(): Area<AppState> {
  const input = el("input", { id: "ci", placeholder: ASSISTANT_TEXT.placeholder, autocomplete: "off", "aria-label": ASSISTANT_TEXT.placeholder });
  const send = el("button", { class: "de-iconbtn de-iconbtn-send", id: "cs", type: "submit", disabled: true, "aria-label": "Send" }, icon("send", 20, { stroke: 1.8 }));
  const form = el("form", { class: "l-cf", id: "cf" }, input, send);
  form.addEventListener("submit", (e) => e.preventDefault());
  const element = el(
    "aside",
    { class: "l-right", id: "right", "aria-label": "Assistant" },
    el("div", { class: "l-ch" }, el("span", { class: "de-label" }, "Assistant"), el("span", { class: "de-tag" }, "On this computer")),
    el("div", { class: "l-msgs de-scroll", id: "msgs" }),
    el("div", { class: "l-comp" }, form, el("div", { class: "l-cn" }, ASSISTANT_TEXT.note)),
  );
  return {
    element,
    render(s) {
      element.hidden = !s.assistantShown;
    },
  };
}
