// T44 acceptance (Run 4, Grant 2026-11-18 to 2026-11-19, scope items 5.1 to 5.4).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const recents = () => screen.getByRole("complementary", { name: "Recents" });
const actions = () => recents().querySelector(".actions") as HTMLElement;

describe("New file (5.4)", () => {
  it("is a button directly below Open, in Open's style", () => {
    render(<App />);
    const buttons = within(actions()).getAllByRole("button");
    const open = within(actions()).getByRole("button", { name: "Open" });
    const nf = within(actions()).getByRole("button", { name: "New file" });
    expect(buttons.indexOf(nf)).toBe(buttons.indexOf(open) + 1);
    expect(open.nextElementSibling).toBe(nf);
    expect(nf.className).toBe(open.className);
  });

  it("creates a Markdown file, a new one each time", () => {
    render(<App />);
    fireEvent.click(within(recents()).getByRole("button", { name: "New file" }));
    let s = window.__collide!.state();
    expect(s.view).toBe("markdown");
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0]).toMatchObject({ kind: "markdown", active: true });
    expect(s.tabs[0].title).toMatch(/\.md$/);
    fireEvent.click(within(recents()).getByRole("button", { name: "New file" }));
    s = window.__collide!.state();
    expect(s.tabs).toHaveLength(2);
    expect(s.tabs.every((t) => t.kind === "markdown" && t.title.endsWith(".md"))).toBe(true);
    expect(s.tabs[0].title).not.toBe(s.tabs[1].title);
  });
});

describe("Collapse view (5.2, 5.3)", () => {
  it("shows New snip, the delay, Add snip with Current/Behind, Open and New file; Search and Recents are hidden", () => {
    window.history.replaceState(null, "", "/?sample");
    render(<App />);
    expect(within(recents()).getByText("Today")).toBeTruthy();
    fireEvent.click(within(recents()).getByRole("button", { name: "Collapse window" }));
    const side = within(recents());
    for (const name of ["New snip", "Add snip", "Open", "New file"]) expect(side.getByRole("button", { name })).toBeTruthy();
    expect(side.getByRole("radiogroup", { name: "Delay before New snip captures" })).toBeTruthy();
    expect(side.getByRole("radiogroup", { name: "Where Add snip captures" })).toBeTruthy();
    expect(side.queryByRole("textbox", { name: "Search" })).toBeNull();
    expect(side.queryByText("Today")).toBeNull();
    expect(side.queryByText("Earlier")).toBeNull();
    expect(side.queryByRole("button", { name: /^Line 3 conveyor guard/ })).toBeNull();
    // New file works from the collapse view too.
    fireEvent.click(side.getByRole("button", { name: "New file" }));
    expect(window.__collide!.state().tabs[0]).toMatchObject({ kind: "markdown" });
    // Expanded again, Search and Recents come back.
    fireEvent.click(within(recents()).getByRole("button", { name: "Expand window" }));
    expect(within(recents()).getByRole("textbox", { name: "Search" })).toBeTruthy();
    expect(within(recents()).getByText("Today")).toBeTruthy();
  });

  it("the tab header has no collapse button; the sidebar's stays", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings and Connect" }));
    expect(screen.getAllByRole("button", { name: /^(Collapse|Expand) window$/ })).toHaveLength(1);
    expect(within(recents()).getByRole("button", { name: "Collapse window" })).toBeTruthy();
  });
});

describe("Connected pill (5.1)", () => {
  const pill = () => within(recents()).queryByTestId("connected-pill");
  const enable = () => screen.getByRole("button", { name: "Enable Connected mode" });

  it("is hidden until Settings → Enable Connected mode; reads Connected; off light with no address; turns off again", () => {
    const f = vi.fn(async () => new Response(null));
    vi.stubGlobal("fetch", f);
    render(<App />);
    expect(pill()).toBeNull();
    expect(within(recents()).queryByText("Server")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Settings and Connect" }));
    expect(enable().getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(enable());
    expect(enable().getAttribute("aria-pressed")).toBe("true");
    expect(pill()?.textContent).toBe("Connected");
    expect(pill()?.getAttribute("data-light")).toBe("off");
    // No address: nothing is asked.
    expect(f).not.toHaveBeenCalled();
    // Remembered.
    expect(JSON.parse(localStorage.getItem("collide.settings")!)).toMatchObject({ mode: "client" });
    fireEvent.click(enable());
    expect(pill()).toBeNull();
  });

  it("green when the saved address answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null)));
    localStorage.setItem("collide.settings", JSON.stringify({ keep: "", mode: "client", server: "server-pc:3500" }));
    render(<App />);
    await waitFor(() => expect(pill()?.getAttribute("data-light")).toBe("on"));
  });

  it("off when the saved address does not answer", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", f);
    localStorage.setItem("collide.settings", JSON.stringify({ keep: "", mode: "client", server: "server-pc:3500" }));
    render(<App />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(pill()?.textContent).toBe("Connected");
    expect(pill()?.getAttribute("data-light")).toBe("off");
  });
});
