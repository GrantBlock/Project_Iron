// Right side: the Assistant (L07), as the prototype: the greeting, three suggested questions,
// the conversation with numbered citation chips and source rows that open the cited page
// (and the View tab under 900px), and the composer. Answers come from an AnswerEngine
// (assistant/engine.ts; canned in this run). All text goes in as text nodes.
import { citationPieces, type AnswerEngine } from "../assistant/engine";
import { ASSISTANT_TEXT, SUGGESTIONS, findItem } from "../data/sample";
import { addAnswer, askQuestion, select, type AppState, type Message, type Store } from "../state";
import { el, type Area } from "./dom";
import { icon } from "./icons";

export function createRight(store: Store, engine: AnswerEngine, isNarrow: () => boolean): Area<AppState> {
  const ask = (question: string) => {
    store.update((s) => askQuestion(s, question));
    void engine.answer(question).then((answer) => store.update((s) => addAnswer(s, answer)));
  };

  const msgs = el("div", { class: "l-msgs de-scroll", id: "msgs" });
  const suggestions = el("div", { class: "l-sug" }, ...SUGGESTIONS.map((q) => el("button", { type: "button" }, q)));
  suggestions.addEventListener("click", (e) => {
    const b = (e.target as Element).closest("button");
    if (b) ask(b.textContent ?? "");
  });
  // Citation chips and source rows open the cited item at the page.
  msgs.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-o]");
    if (b) store.update((s) => select(s, b.dataset.o ?? "", { page: Number(b.dataset.pg) || 0, highlight: "", narrow: isNarrow() }));
  });

  const input = el("input", { id: "ci", placeholder: ASSISTANT_TEXT.placeholder, autocomplete: "off", "aria-label": ASSISTANT_TEXT.placeholder });
  const send = el("button", { class: "de-iconbtn de-iconbtn-send", id: "cs", type: "submit", disabled: true, "aria-label": "Send" }, icon("send", 20, { stroke: 1.8 }));
  const arm = (on: boolean) => {
    send.disabled = !on;
    send.classList.toggle("is-armed", on);
  };
  input.addEventListener("input", () => arm(input.value.trim() !== ""));
  const form = el("form", { class: "l-cf", id: "cf" }, input, send);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    arm(false);
    ask(q);
  });

  const element = el(
    "aside",
    { class: "l-right", id: "right", "aria-label": "Assistant" },
    el("div", { class: "l-ch" }, el("span", { class: "de-label" }, "Assistant"), el("span", { class: "de-tag" }, "On this computer")),
    msgs,
    el("div", { class: "l-comp" }, form, el("div", { class: "l-cn" }, ASSISTANT_TEXT.note)),
  );

  let shown: readonly Message[] = [];
  return {
    element,
    render(s) {
      element.hidden = !s.assistantShown;
      if (s.messages !== shown) {
        // Messages only grow: append the new ones (keeps scroll position and focus); rebuild otherwise.
        const grows = shown.length <= s.messages.length && shown.every((m, i) => s.messages[i] === m);
        if (!grows) {
          msgs.replaceChildren();
          shown = [];
        }
        for (const m of s.messages.slice(shown.length)) msgs.insertBefore(message(m), suggestions.parentNode === msgs ? suggestions : null);
        shown = s.messages;
        msgs.scrollTop = msgs.scrollHeight;
      }
      if (s.suggestionsShown && suggestions.parentNode !== msgs) msgs.appendChild(suggestions);
      if (!s.suggestionsShown) suggestions.remove();
    },
  };
}

/** One message, as the prototype's msg(): user bubble, or "Assistant" label + text with chips + source rows. */
export function message(m: Message): HTMLElement {
  if (m.role === "user") return el("div", { class: "l-m u" }, m.text);
  const body = citationPieces(m.text, m.sources.length).map((p) => {
    if ("text" in p) return p.text;
    const src = m.sources[p.cite - 1];
    return el("button", { class: "l-cite", type: "button", "data-o": src.itemId, "data-pg": src.page, "aria-label": `Open source ${p.cite}` }, String(p.cite));
  });
  const rows = m.sources.length
    ? el(
        "div",
        { class: "l-src" },
        ...m.sources.map((src, i) =>
          el("button", { type: "button", "data-o": src.itemId, "data-pg": src.page }, el("b", {}, String(i + 1)), el("span", {}, `${findItem(src.itemId)?.title ?? src.itemId} · ${src.label}`)),
        ),
      )
    : null;
  return el("div", { class: "l-m" }, el("span", { class: "who" }, "Assistant"), ...body, rows);
}
