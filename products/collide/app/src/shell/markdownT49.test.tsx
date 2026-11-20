// T49 (tests first, Lydia): a Markdown tab is one live CodeMirror editor. Assumed hooks: `.cm-editor` > `.cm-content`
// (contenteditable, aria-label = the file name) in the Workspace region; marks in `.md-mark` spans.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App";

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

const side = () => screen.getByRole("complementary", { name: "Recents" });
const open = () => {
  render(<App />);
  fireEvent.click(within(side()).getByRole("button", { name: "New file" }));
  return screen.getByRole("region", { name: "Workspace" });
};

describe("Markdown: one live editor (T49)", () => {
  it("has no Edit / Preview toggle and no textarea; the text is one CodeMirror editor", () => {
    const ws = open();
    expect(within(ws).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(ws).queryByRole("button", { name: "Preview" })).toBeNull();
    expect(ws.querySelector("textarea")).toBeNull();
    expect(ws.querySelectorAll(".cm-editor")).toHaveLength(1);
    const content = ws.querySelector(".cm-content") as HTMLElement;
    expect(content.getAttribute("contenteditable")).toBe("true");
    expect(content.getAttribute("aria-label")).toMatch(/\.md$/);
  });

  it("the text tools are on and the callout tools are on in the same view", () => {
    const ws = open();
    const text = within(ws).getByRole("group", { name: "Text tools" });
    for (const name of ["Bold", "Link"]) expect((within(text).getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
    expect((within(ws).getByRole("button", { name: "Rectangle" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a text tool changes the editor's text and marks the tab changed", () => {
    const ws = open();
    const text = within(ws).getByRole("group", { name: "Text tools" });
    fireEvent.click(within(text).getByRole("button", { name: "Bold" }));
    const lines = () => [...ws.querySelectorAll(".cm-line")].map((l) => l.textContent).join("\n");
    expect(lines()).toContain("****");
    expect(window.__collide!.state().tabs[0].dirty).toBe(true);
    // The marks are in the DOM, dimmed by class.
    expect(ws.querySelectorAll(".md-mark").length).toBeGreaterThan(0);
  });
});
