// T48 (Grant 2026-11-20): the collapse button swaps the full app and the compact view. Written before the code (Lydia).
// Assumed hooks: the compact block (brand row + actions) has data-testid="compact-block"; the workspace region (tabs and
// canvas) is hidden (not unmounted, so tab state stays) while compact; the footer is not rendered while compact.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App";

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

// jsdom has no shell.css: "hidden" here means the `hidden` attribute (or not rendered), which testing-library's role queries respect.
const gone = (el: HTMLElement | null) => expect(el === null || el.closest("[hidden]") !== null).toBe(true);
const side = () => screen.getByRole("complementary", { name: "Recents" });
const root = () => screen.getByTestId("app-root");
const toggle = (name: "Collapse window" | "Expand window") => fireEvent.click(within(side()).getByRole("button", { name }));
const openTabs = () => {
  fireEvent.click(within(side()).getByRole("button", { name: "New file" }));
  fireEvent.click(within(side()).getByRole("button", { name: "New file" }));
};

describe("Compact view (T48)", () => {
  it("with tabs open, collapsing hides Search, Recents, Tags, the footer, the tab bar and the canvas", () => {
    window.history.replaceState(null, "", "/?sample");
    render(<App />);
    openTabs();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(within(side()).getByRole("textbox", { name: "Search" })).toBeTruthy();
    expect(within(side()).getByText("Today")).toBeTruthy();

    toggle("Collapse window");
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("region", { name: "Workspace" })).toBeNull(); // hidden: not in the accessibility tree
    gone(screen.queryByTestId("canvas"));
    expect(within(side()).queryByRole("textbox", { name: "Search" })).toBeNull();
    expect(within(side()).queryByText("Today")).toBeNull();
    expect(within(side()).queryByText("Earlier")).toBeNull();
    expect(within(side()).queryByText("Tags")).toBeNull();
    expect(screen.queryByRole("button", { name: "Appearance" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Settings and Connect" })).toBeNull();
    expect(root().className).toContain("compact");
    expect(root().className).not.toContain("with-canvas");
  });

  it("with nothing open it is the same", () => {
    render(<App />);
    toggle("Collapse window");
    gone(screen.queryByTestId("canvas"));
    expect(screen.queryByRole("button", { name: "Settings and Connect" })).toBeNull();
  });

  it("shows the brand row, New snip + delay, Add snip + Current/Behind, Open and New file, and nothing else in the block", () => {
    render(<App />);
    toggle("Collapse window");
    const block = screen.getByTestId("compact-block");
    const b = within(block);
    expect(b.getByText("Collide")).toBeTruthy();
    expect(b.getByRole("button", { name: "Expand window" })).toBeTruthy();
    for (const name of ["New snip", "Add snip", "Open", "New file"]) expect(b.getByRole("button", { name })).toBeTruthy();
    expect(b.getByRole("radiogroup", { name: "Delay before New snip captures" })).toBeTruthy();
    expect(b.getByRole("radiogroup", { name: "Where Add snip captures" })).toBeTruthy();
    expect(b.queryByTestId("connected-pill")).toBeNull(); // only when Connected mode is on
    // The block is the whole sidebar content: every button of the sidebar is inside it.
    for (const btn of within(side()).getAllByRole("button")) expect(block.contains(btn)).toBe(true);
  });

  it("the Connected pill shows in the compact brand row only when it is enabled", () => {
    localStorage.setItem("collide.settings", JSON.stringify({ keep: "", mode: "client", server: "" }));
    render(<App />);
    toggle("Collapse window");
    expect(within(screen.getByTestId("compact-block")).getByTestId("connected-pill")).toBeTruthy();
  });

  it("the button reads Collapse / Expand in its aria-label and title, and swaps back", () => {
    render(<App />);
    const collapse = within(side()).getByRole("button", { name: "Collapse window" });
    expect(collapse.getAttribute("title")).toMatch(/^Collapse/);
    fireEvent.click(collapse);
    const expand = within(side()).getByRole("button", { name: "Expand window" });
    expect(expand.getAttribute("title")).toMatch(/^Expand/);
    expect(within(side()).queryByRole("button", { name: "Collapse window" })).toBeNull();
    fireEvent.click(expand);
    expect(within(side()).getByRole("button", { name: "Collapse window" })).toBeTruthy();
  });

  it("tabs, the canvas and the footer return on Expand, with the tab state as it was", () => {
    window.history.replaceState(null, "", "/?sample");
    render(<App />);
    openTabs();
    const before = window.__collide!.state().tabs;
    expect(before).toHaveLength(2);
    toggle("Collapse window");
    expect(window.__collide!.state().tabs).toEqual(before); // kept while compact
    toggle("Expand window");
    expect(window.__collide!.state().tabs).toEqual(before);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Workspace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings and Connect" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Appearance" })).toBeTruthy();
    expect(within(side()).getByRole("textbox", { name: "Search" })).toBeTruthy();
    expect(within(side()).getByText("Today")).toBeTruthy();
    expect(root().className).not.toContain("compact");
  });

  it("New file from the compact view opens a tab that stays hidden until Expand", () => {
    render(<App />);
    toggle("Collapse window");
    fireEvent.click(within(side()).getByRole("button", { name: "New file" }));
    expect(window.__collide!.state().tabs).toHaveLength(1);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    toggle("Expand window");
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("collide.collapsed and state().sidebar.collapsed are kept, and a reload comes back compact", () => {
    const first = render(<App />);
    expect(window.__collide!.state().sidebar.collapsed).toBe(false);
    toggle("Collapse window");
    expect(localStorage.getItem("collide.collapsed")).toBe("1");
    expect(window.__collide!.state().sidebar.collapsed).toBe(true);
    first.unmount();
    render(<App />);
    expect(window.__collide!.state().sidebar.collapsed).toBe(true);
    gone(screen.queryByTestId("canvas"));
    toggle("Expand window");
    expect(localStorage.getItem("collide.collapsed")).toBe("0");
    expect(window.__collide!.state().sidebar.collapsed).toBe(false);
  });

  it("the desktop page sends { collapsed, height } with the compact block's height, and no canvas flag", async () => {
    const calls: { collapsed: boolean; height?: number; canvas?: boolean }[] = [];
    (window as unknown as { collide: unknown }).collide = {
      collapse: async (r: (typeof calls)[number]) => {
        calls.push(r);
        return { maximized: false };
      },
    };
    try {
      render(<App />);
      toggle("Collapse window");
      await Promise.resolve();
      const last = calls[calls.length - 1];
      expect(last.collapsed).toBe(true);
      expect(typeof last.height).toBe("number");
      expect("canvas" in last).toBe(false);
      toggle("Expand window");
      await Promise.resolve();
      expect(calls[calls.length - 1].collapsed).toBe(false);
    } finally {
      delete (window as unknown as { collide?: unknown }).collide;
    }
  });
});
